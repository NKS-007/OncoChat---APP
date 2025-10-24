"""
model_train.py
-------------------------------------
Downloads small lung cancer dataset (LIDC-IDRI) from TCIA,
converts DICOM -> PNG, trains CNN classifier, saves model.
"""

import os, io, zipfile, random, requests, pydicom, numpy as np
from tqdm import tqdm
from PIL import Image
import torch
import torch.nn as nn
import torch.optim as optim
from torchvision import transforms, datasets, models
from torch.utils.data import DataLoader, random_split

# -------------------------------
# Paths
# -------------------------------
BASE_DIR = os.path.dirname(__file__)
RAW_DIR = os.path.join(BASE_DIR, "data", "raw")
PROC_DIR = os.path.join(BASE_DIR, "data", "processed")
TRAIN_DIR = os.path.join(BASE_DIR, "data", "train")
MODEL_DIR = os.path.join(BASE_DIR, "models")

for d in [RAW_DIR, PROC_DIR, TRAIN_DIR, MODEL_DIR]:
    os.makedirs(d, exist_ok=True)

TCIA_API = "https://services.cancerimagingarchive.net/services/v3/TCIA/query"
COLLECTION = "LIDC-IDRI"  # Lung CT dataset

# -------------------------------
# Step 1: Get few image series
# -------------------------------
def get_series(collection=COLLECTION, limit=3):
    print(f"📡 Fetching {limit} series from {collection}...")
    try:
        url = f"{TCIA_API}/getSeries?Collection={collection}"
        r = requests.get(url, timeout=120)
        r.raise_for_status()
        series = r.json()
        print(f"✅ Got {len(series)} total, sampling {limit}.")
        random.shuffle(series)
        return series[:limit]
    except Exception as e:
        print("❌ TCIA fetch failed:", e)
        return []

series_list = get_series()

if not series_list:
    raise SystemExit("No series retrieved from TCIA (try again later).")

# -------------------------------
# Step 2: Download + convert
# -------------------------------
def dicom_to_png(dicom_bytes, out_path):
    try:
        ds = pydicom.dcmread(io.BytesIO(dicom_bytes))
        arr = ds.pixel_array.astype(float)
        arr = (np.maximum(arr, 0) / arr.max()) * 255.0
        img = Image.fromarray(np.uint8(arr))
        img.save(out_path)
    except Exception as e:
        print("⚠️ Conversion error:", e)

print("📦 Downloading and converting images...")
for idx, s in enumerate(series_list):
    uid = s["SeriesInstanceUID"]
    zip_url = f"{TCIA_API}/getImage?SeriesInstanceUID={uid}"
    try:
        resp = requests.get(zip_url, stream=True, timeout=300)
        with zipfile.ZipFile(io.BytesIO(resp.content)) as zf:
            members = [m for m in zf.namelist() if m.lower().endswith(".dcm")]
            for m in members[:10]:
                out_png = os.path.join(PROC_DIR, f"{uid}_{os.path.basename(m)}.png")
                with zf.open(m) as f:
                    dicom_to_png(f.read(), out_png)
    except Exception as e:
        print(f"⚠️ Skipping {uid}: {e}")

print(f"✅ Conversion complete! Check {PROC_DIR}")

# -------------------------------
# Step 3: Assign dummy labels (balanced)
# -------------------------------
cancer_dir = os.path.join(TRAIN_DIR, "cancerous")
non_dir = os.path.join(TRAIN_DIR, "non_cancerous")
os.makedirs(cancer_dir, exist_ok=True)
os.makedirs(non_dir, exist_ok=True)

pngs = sorted(os.listdir(PROC_DIR))
half = len(pngs) // 2
for i, img in enumerate(pngs):
    src = os.path.join(PROC_DIR, img)
    dst = os.path.join(cancer_dir if i < half else non_dir, img)
    if not os.path.exists(dst):
        Image.open(src).save(dst)

# -------------------------------
# Step 4: Train the model
# -------------------------------
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
print(f"🧠 Training on device: {device}")

transform = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
])

dataset = datasets.ImageFolder(TRAIN_DIR, transform=transform)
train_len = int(0.8 * len(dataset))
val_len = len(dataset) - train_len
train_ds, val_ds = random_split(dataset, [train_len, val_len])
train_loader = DataLoader(train_ds, batch_size=8, shuffle=True)
val_loader = DataLoader(val_ds, batch_size=8)

model = models.resnet18(pretrained=True)
model.fc = nn.Linear(model.fc.in_features, 2)
model = model.to(device)

criterion = nn.CrossEntropyLoss()
optimizer = optim.Adam(model.parameters(), lr=0.001)

print("🚀 Training (3 epochs)...")
for epoch in range(3):
    model.train()
    total_loss = 0
    for imgs, labels in train_loader:
        imgs, labels = imgs.to(device), labels.to(device)
        optimizer.zero_grad()
        outputs = model(imgs)
        loss = criterion(outputs, labels)
        loss.backward()
        optimizer.step()
        total_loss += loss.item()
    print(f"Epoch {epoch+1}: loss={total_loss/len(train_loader):.4f}")

torch.save(model.state_dict(), os.path.join(MODEL_DIR, "cancer_classifier.pt"))
print("✅ Model saved to backend/models/cancer_classifier.pt")
