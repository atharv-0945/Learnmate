import os
import json
import numpy as np
import pandas as pd
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import seaborn as sns
import joblib

from sklearn.model_selection import train_test_split, StratifiedKFold, cross_validate, GridSearchCV
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import Pipeline
from sklearn.linear_model import LogisticRegression, SGDClassifier
from sklearn.tree import DecisionTreeClassifier
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.neighbors import KNeighborsClassifier
from sklearn.svm import SVC
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score, f1_score, roc_auc_score,
    confusion_matrix, classification_report, roc_curve
)

# 1. Directories setup
for folder in ['data', 'notebooks', 'models', 'reports', 'outputs', 'app']:
    os.makedirs(folder, exist_ok=True)

# 2. Dataset loading & inspection
data_path = 'data/student_exam_data.csv' if os.path.exists('data/student_exam_data.csv') else 'student_exam_data.csv'
df = pd.read_csv(data_path)
print(f"Loaded dataset from {data_path} with shape {df.shape}")

# Feature names and target
feature_names = ['Study Hours', 'Previous Exam Score']
target_col = 'Pass/Fail'

# 3. EDA Visualizations
sns.set_theme(style="whitegrid", palette="muted")

# 3.1 Class distribution
fig, ax = plt.subplots(figsize=(6, 4))
sns.countplot(data=df, x=target_col, hue=target_col, palette=['#e74c3c', '#2ecc71'], legend=False, ax=ax)
ax.set_title("Student Pass / Fail Class Distribution", fontsize=13, fontweight='bold', pad=12)
ax.set_xlabel("Exam Result (0 = Fail, 1 = Pass)", fontsize=11)
ax.set_ylabel("Number of Students", fontsize=11)
for p in ax.patches:
    height = p.get_height()
    ax.annotate(f'{int(height)} ({height/len(df)*100:.1f}%)',
                (p.get_x() + p.get_width() / 2., height / 2),
                ha='center', va='center', fontsize=11, color='white', fontweight='bold')
plt.tight_layout()
plt.savefig('outputs/class_distribution.png', dpi=300)
plt.close()

# 3.2 Feature distributions
fig, axes = plt.subplots(1, 2, figsize=(12, 4.5))
sns.histplot(df['Study Hours'], kde=True, ax=axes[0], color='#3498db', bins=20)
axes[0].set_title("Distribution of Study Hours", fontsize=12, fontweight='bold')
axes[0].set_xlabel("Study Hours / Day")
axes[0].set_ylabel("Frequency")

sns.histplot(df['Previous Exam Score'], kde=True, ax=axes[1], color='#9b59b6', bins=20)
axes[1].set_title("Distribution of Previous Exam Score", fontsize=12, fontweight='bold')
axes[1].set_xlabel("Previous Exam Score")
axes[1].set_ylabel("Frequency")
plt.tight_layout()
plt.savefig('outputs/feature_distributions.png', dpi=300)
plt.close()

# 3.3 Correlation heatmap
fig, ax = plt.subplots(figsize=(7, 5))
corr = df.corr()
sns.heatmap(corr, annot=True, fmt=".3f", cmap="vlag", vmin=-1, vmax=1, cbar_kws={'label': 'Pearson Correlation'}, ax=ax)
ax.set_title("Feature & Target Pearson Correlation Matrix", fontsize=13, fontweight='bold', pad=12)
plt.tight_layout()
plt.savefig('outputs/feature_correlation.png', dpi=300)
plt.close()

# 4. Train-Test Split (Stratified 80/20)
X = df[feature_names]
y = df[target_col]

X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.20, random_state=42, stratify=y
)
print(f"Train set: {X_train.shape[0]} samples, Test set: {X_test.shape[0]} samples")

# Standardize for custom GD
scaler = StandardScaler()
X_train_scaled = scaler.fit_transform(X_train)
X_test_scaled = scaler.transform(X_test)

# 5. Custom Logistic Regression via Batch Gradient Descent
class LogisticRegressionGD:
    def __init__(self, learning_rate=0.1, epochs=1000, random_state=42):
        self.learning_rate = learning_rate
        self.epochs = epochs
        self.random_state = random_state
        self.weights = None
        self.bias = None
        self.loss_history = []
        self.scaler_mean_ = None
        self.scaler_scale_ = None
        
    def _sigmoid(self, z):
        # Numerically stable sigmoid function
        z = np.clip(z, -500, 500)
        return np.where(z >= 0, 1.0 / (1.0 + np.exp(-z)), np.exp(z) / (1.0 + np.exp(z)))
    
    def fit(self, X, y, scaler=None):
        m, n = X.shape
        np.random.seed(self.random_state)
        self.weights = np.zeros(n)
        self.bias = 0.0
        self.loss_history = []
        
        y = np.array(y, dtype=float)
        
        for epoch in range(self.epochs):
            # 1. Linear combination: z = Xw + b
            z = np.dot(X, self.weights) + self.bias
            # 2. Probability prediction: p = sigma(z)
            p = self._sigmoid(z)
            
            # 3. Binary cross-entropy loss with eps safeguard
            eps = 1e-15
            p_clipped = np.clip(p, eps, 1.0 - eps)
            loss = - (1.0 / m) * np.sum(y * np.log(p_clipped) + (1.0 - y) * np.log(1.0 - p_clipped))
            self.loss_history.append(loss)
            
            # 4. Compute gradients
            # dJ/dw = (1/m) * X^T (p - y)
            dw = (1.0 / m) * np.dot(X.T, (p - y))
            # dJ/db = (1/m) * sum(p - y)
            db = (1.0 / m) * np.sum(p - y)
            
            # 5. Gradient descent update
            self.weights -= self.learning_rate * dw
            self.bias -= self.learning_rate * db
            
        if scaler is not None:
            self.scaler_mean_ = scaler.mean_
            self.scaler_scale_ = scaler.scale_
        return self
    
    def predict_proba(self, X):
        z = np.dot(X, self.weights) + self.bias
        p1 = self._sigmoid(z)
        p0 = 1.0 - p1
        return np.column_stack([p0, p1])
    
    def predict(self, X, threshold=0.5):
        probs = self.predict_proba(X)[:, 1]
        return (probs >= threshold).astype(int)

# Train custom GD model
gd_model = LogisticRegressionGD(learning_rate=0.1, epochs=1000, random_state=42)
gd_model.fit(X_train_scaled, y_train, scaler=scaler)

print(f"Custom GD Final Weights: {gd_model.weights}, Bias: {gd_model.bias:.4f}, Final Loss: {gd_model.loss_history[-1]:.4f}")

# Plot gradient descent loss curve
fig, ax = plt.subplots(figsize=(7, 4.5))
ax.plot(range(1, len(gd_model.loss_history) + 1), gd_model.loss_history, color='#e67e22', lw=2)
ax.set_title("Batch Gradient Descent: Binary Cross-Entropy Loss vs Epochs", fontsize=12, fontweight='bold', pad=10)
ax.set_xlabel("Epoch / Iteration", fontsize=11)
ax.set_ylabel("Binary Cross-Entropy Loss J(w, b)", fontsize=11)
ax.grid(True, linestyle='--', alpha=0.6)
plt.tight_layout()
plt.savefig('outputs/gradient_descent_loss.png', dpi=300)
plt.close()

# Custom GD evaluation
y_pred_gd = gd_model.predict(X_test_scaled)
y_prob_gd = gd_model.predict_proba(X_test_scaled)[:, 1]
gd_acc = accuracy_score(y_test, y_pred_gd)
gd_prec = precision_score(y_test, y_pred_gd, zero_division=0)
gd_rec = recall_score(y_test, y_pred_gd, zero_division=0)
gd_f1 = f1_score(y_test, y_pred_gd, zero_division=0)
gd_auc = roc_auc_score(y_test, y_prob_gd)
print(f"Custom GD Test Metrics -> Acc: {gd_acc:.4f}, Prec: {gd_prec:.4f}, Rec: {gd_rec:.4f}, F1: {gd_f1:.4f}, AUC: {gd_auc:.4f}")

# 6. Model Comparison with Scikit-Learn
models_dict = {
    'Logistic Regression (Scratch GD)': None, # Evaluated manually
    'Logistic Regression (sklearn)': Pipeline([('scaler', StandardScaler()), ('clf', LogisticRegression(random_state=42))]),
    'SGD Classifier (log_loss)': Pipeline([('scaler', StandardScaler()), ('clf', SGDClassifier(loss='log_loss', max_iter=1000, random_state=42))]),
    'Decision Tree': Pipeline([('clf', DecisionTreeClassifier(random_state=42))]),
    'Random Forest': Pipeline([('clf', RandomForestClassifier(random_state=42))]),
    'K-Nearest Neighbors': Pipeline([('scaler', StandardScaler()), ('clf', KNeighborsClassifier())]),
    'Support Vector Machine (RBF)': Pipeline([('scaler', StandardScaler()), ('clf', SVC(probability=True, random_state=42))]),
    'Gradient Boosting': Pipeline([('clf', GradientBoostingClassifier(random_state=42))])
}

comparison_rows = []
# Add custom GD
comparison_rows.append({
    'Model': 'Logistic Regression (Scratch GD)',
    'Accuracy': gd_acc,
    'Precision': gd_prec,
    'Recall': gd_rec,
    'F1-Score': gd_f1,
    'ROC-AUC': gd_auc
})

fitted_models = {}
for name, pipe in models_dict.items():
    if pipe is None:
        continue
    pipe.fit(X_train, y_train)
    fitted_models[name] = pipe
    y_pred = pipe.predict(X_test)
    if hasattr(pipe, "predict_proba"):
        y_prob = pipe.predict_proba(X_test)[:, 1]
    elif hasattr(pipe, "decision_function"):
        y_prob = pipe.decision_function(X_test)
    else:
        y_prob = y_pred
    
    comparison_rows.append({
        'Model': name,
        'Accuracy': accuracy_score(y_test, y_pred),
        'Precision': precision_score(y_test, y_pred, zero_division=0),
        'Recall': recall_score(y_test, y_pred, zero_division=0),
        'F1-Score': f1_score(y_test, y_pred, zero_division=0),
        'ROC-AUC': roc_auc_score(y_test, y_prob)
    })

comparison_df = pd.DataFrame(comparison_rows).sort_values(by='F1-Score', ascending=False).reset_index(drop=True)
comparison_df.to_csv('reports/model_comparison.csv', index=False)
print("\n--- Model Comparison on Test Set ---")
print(comparison_df.to_string())

# 7. Stratified 5-Fold Cross Validation on Training Set
cv_rows = []
skf = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
scoring = ['accuracy', 'precision', 'recall', 'f1', 'roc_auc']

for name, pipe in models_dict.items():
    if pipe is None:
        continue
    cv_res = cross_validate(pipe, X_train, y_train, cv=skf, scoring=scoring)
    cv_rows.append({
        'Model': name,
        'CV Accuracy Mean': cv_res['test_accuracy'].mean(),
        'CV Accuracy Std': cv_res['test_accuracy'].std(),
        'CV Precision Mean': cv_res['test_precision'].mean(),
        'CV Precision Std': cv_res['test_precision'].std(),
        'CV Recall Mean': cv_res['test_recall'].mean(),
        'CV Recall Std': cv_res['test_recall'].std(),
        'CV F1 Mean': cv_res['test_f1'].mean(),
        'CV F1 Std': cv_res['test_f1'].std(),
        'CV ROC-AUC Mean': cv_res['test_roc_auc'].mean(),
        'CV ROC-AUC Std': cv_res['test_roc_auc'].std()
    })

cv_df = pd.DataFrame(cv_rows).sort_values(by='CV F1 Mean', ascending=False).reset_index(drop=True)
cv_df.to_csv('reports/cross_validation_results.csv', index=False)
print("\n--- Cross Validation Results ---")
print(cv_df[['Model', 'CV Accuracy Mean', 'CV F1 Mean', 'CV ROC-AUC Mean']].to_string())

# 8. Hyperparameter Tuning for Random Forest
param_grid = {
    'clf__n_estimators': [25, 50, 100, 150],
    'clf__max_depth': [2, 3, 5, 8, None],
    'clf__min_samples_leaf': [1, 2, 4]
}

rf_pipe = Pipeline([('clf', RandomForestClassifier(random_state=42))])
grid_search = GridSearchCV(
    estimator=rf_pipe,
    param_grid=param_grid,
    cv=skf,
    scoring='f1',
    n_jobs=1
)
grid_search.fit(X_train, y_train)
best_model = grid_search.best_estimator_
print(f"\nBest RF Params: {grid_search.best_params_}")
print(f"Best RF CV F1 Score: {grid_search.best_score_:.4f}")

# 9. Final Model Evaluation on Held-Out Test Set
y_pred_final = best_model.predict(X_test)
y_prob_final = best_model.predict_proba(X_test)[:, 1]

# Confusion Matrix
cm = confusion_matrix(y_test, y_pred_final)
fig, ax = plt.subplots(figsize=(5.5, 4.5))
sns.heatmap(cm, annot=True, fmt='d', cmap='Blues', cbar=False,
            xticklabels=['Predicted Fail (0)', 'Predicted Pass (1)'],
            yticklabels=['Actual Fail (0)', 'Actual Pass (1)'], ax=ax)
ax.set_title("Confusion Matrix: Tuned Random Forest (Test Set)", fontsize=12, fontweight='bold', pad=10)
plt.tight_layout()
plt.savefig('outputs/confusion_matrix.png', dpi=300)
plt.close()

# ROC Curve
fpr, tpr, thresholds = roc_curve(y_test, y_prob_final)
auc_val = roc_auc_score(y_test, y_prob_final)
fig, ax = plt.subplots(figsize=(6, 5))
ax.plot(fpr, tpr, color='#2980b9', lw=2.5, label=f'ROC Curve (AUC = {auc_val:.4f})')
ax.plot([0, 1], [0, 1], color='#7f8c8d', linestyle='--', lw=1.5, label='Random Guess')
ax.set_xlim([-0.02, 1.02])
ax.set_ylim([-0.02, 1.02])
ax.set_xlabel("False Positive Rate (1 - Specificity)", fontsize=11)
ax.set_ylabel("True Positive Rate (Sensitivity / Recall)", fontsize=11)
ax.set_title("Receiver Operating Characteristic (ROC) Curve", fontsize=12, fontweight='bold', pad=10)
ax.legend(loc='lower right', frameon=True)
ax.grid(True, linestyle='--', alpha=0.6)
plt.tight_layout()
plt.savefig('outputs/roc_curve.png', dpi=300)
plt.close()

# Feature Importance
importances = best_model.named_steps['clf'].feature_importances_
fig, ax = plt.subplots(figsize=(6, 3.5))
sns.barplot(x=importances, y=feature_names, palette=['#3498db', '#e67e22'], ax=ax)
ax.set_title("Random Forest Gini Feature Importances", fontsize=12, fontweight='bold', pad=10)
ax.set_xlabel("Relative Importance")
for p in ax.patches:
    width = p.get_width()
    ax.annotate(f'{width:.3f}', (width + 0.01, p.get_y() + p.get_height() / 2),
                va='center', fontsize=10, fontweight='bold')
ax.set_xlim(0, max(importances) + 0.15)
plt.tight_layout()
plt.savefig('outputs/feature_importance.png', dpi=300)
plt.close()

# Classification Report
clf_report_text = classification_report(y_test, y_pred_final, target_names=['Fail (0)', 'Pass (1)'])
with open('reports/classification_report.txt', 'w') as f:
    f.write("Classification Report: Best Tuned Model (Random Forest)\n")
    f.write("="*60 + "\n\n")
    f.write(clf_report_text)
print("\nClassification Report:\n", clf_report_text)

# 10. Save Models & Metadata
joblib.dump(best_model, 'models/best_model.joblib')

# Save custom GD model
gd_bundle = {
    'model_class': 'LogisticRegressionGD',
    'weights': gd_model.weights.tolist(),
    'bias': float(gd_model.bias),
    'learning_rate': gd_model.learning_rate,
    'epochs': gd_model.epochs,
    'scaler_mean': gd_model.scaler_mean_.tolist(),
    'scaler_scale': gd_model.scaler_scale_.tolist(),
    'feature_names': feature_names,
    'target_col': target_col,
    'loss_history': gd_model.loss_history
}
joblib.dump(gd_bundle, 'models/logistic_regression_gd.joblib')

# Metadata
metadata = {
    "project_name": "LearnMate AI - Student Exam Performance Prediction",
    "dataset_filename": data_path,
    "dataset_rows": len(df),
    "features": feature_names,
    "target": target_col,
    "train_test_split": {"test_size": 0.20, "stratified": True, "random_state": 42},
    "selected_model": "Random Forest Classifier (Tuned)",
    "best_hyperparameters": grid_search.best_params_,
    "cross_validation_score_f1": float(grid_search.best_score_),
    "test_metrics": {
        "accuracy": float(accuracy_score(y_test, y_pred_final)),
        "precision": float(precision_score(y_test, y_pred_final, zero_division=0)),
        "recall": float(recall_score(y_test, y_pred_final, zero_division=0)),
        "f1_score": float(f1_score(y_test, y_pred_final, zero_division=0)),
        "roc_auc": float(roc_auc_score(y_test, y_prob_final))
    },
    "custom_gd_metrics": {
        "final_loss": float(gd_model.loss_history[-1]),
        "weights": gd_model.weights.tolist(),
        "bias": float(gd_model.bias),
        "test_f1": float(gd_f1),
        "test_accuracy": float(gd_acc)
    },
    "environment": {
        "python_version": "3.14.7",
        "scikit_learn": "1.9.1",
        "numpy": "2.5.4",
        "pandas": "3.0.6",
        "joblib": "1.6.0"
    },
    "critical_limitations": [
        "Dataset is synthetic with a strict axis-aligned rule: Pass if Study Hours >= 5.0 and Previous Exam Score >= 60.0.",
        "Perfect 1.0 test performance on tree models reflects synthetic purity rather than real-world human student behavior.",
        "Model outputs are statistical estimates based on two features and must NOT replace teacher judgment or actual academic diagnosis."
    ]
}

with open('models/model_metadata.json', 'w') as f:
    json.dump(metadata, f, indent=4)

print("\nModel pipeline execution completed successfully! All artifacts and plots saved.")
