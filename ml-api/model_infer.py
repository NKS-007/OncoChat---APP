import torch
from torchvision import models, transforms
from PIL import Image
import torch.nn as nn
import os

class CancerModel:
    def __init__(self, model_path="models/cancer_classifier.pt"):
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.model = models.resnet18(pretrained=False)
        self.model.fc = nn.Linear(self.model.fc.in_features, 2)
        self.model.load_state_dict(torch.load(model_path, map_location=self.device))
        self.model.to(self.device).eval()

        self.transform = transforms.Compose([
            transforms.Resize((224, 224)),
            transforms.ToTensor(),
        ])
        print("✅ Model loaded and ready.")

    def predict(self, image_path):
        img = Image.open(image_path).convert("RGB")
        x = self.transform(img).unsqueeze(0).to(self.device)
        with torch.no_grad():
            out = self.model(x)
            probs = torch.softmax(out, dim=1)[0].cpu().numpy()
        return {
            "Prediction": "Cancerous" if probs[1] > probs[0] else "Non-Cancerous",
            "Cancerous": float(probs[1]),
            "Non_Cancerous": float(probs[0]),
        }
