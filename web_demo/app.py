from flask import Flask, render_template, request, jsonify
import os
import json
import numpy as np
from PIL import Image
import io
import sys

# Đảm bảo in tiếng Việt trên console Windows không bị lỗi font
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

app = Flask(__name__)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.abspath(os.path.join(BASE_DIR, '..'))
OUTPUTS_DIR = os.path.join(PROJECT_DIR, 'outputs')
WEIGHTS_PATH = os.path.join(OUTPUTS_DIR, 'best_model.weights.h5')
CLASS_NAMES_PATH = os.path.join(OUTPUTS_DIR, 'class_names.json')

# Tải danh sách nhãn chuẩn
if os.path.exists(CLASS_NAMES_PATH):
    with open(CLASS_NAMES_PATH, 'r', encoding='utf-8') as f:
        CLASSES = json.load(f)
    print(f"[INFO] Da tai danh sach {len(CLASSES)} nhan tu outputs/class_names.json: {CLASSES}")
else:
    CLASSES = ['freshapples', 'freshbanana', 'freshoranges', 'rottenapples', 'rottenbanana', 'rottenoranges']
    print(f"[WARNING] Dung danh sach nhan mac dinh: {CLASSES}")

IMG_SHAPE = (224, 224, 3)
NUM_CLASSES = len(CLASSES)

model = None
MODEL_LOADED = False

print("[INFO] Dang khoi tao mo hinh ResNet50 va nap trong so tu outputs/best_model.weights.h5...")
try:
    import tensorflow as tf
    from tensorflow.keras.applications.resnet50 import preprocess_input as resnet_preprocess
    from tensorflow.keras.applications import ResNet50
    from tensorflow.keras import layers, models

    # Xây dựng đúng kiến trúc ResNet50 như đã huấn luyện trong Master Notebook
    inputs = tf.keras.Input(shape=IMG_SHAPE)
    x = layers.Lambda(resnet_preprocess, name='preprocess')(inputs)
    base = ResNet50(include_top=False, weights=None, input_shape=IMG_SHAPE)
    base.trainable = False
    x = base(x, training=False)
    x = layers.GlobalAveragePooling2D()(x)
    x = layers.Dense(128, activation='relu')(x)
    outputs = layers.Dense(NUM_CLASSES, activation='softmax')(x)

    model = models.Model(inputs, outputs, name='ResNet50_Classifier')

    if os.path.exists(WEIGHTS_PATH):
        model.load_weights(WEIGHTS_PATH)
        MODEL_LOADED = True
        print(f"[SUCCESS] Da nap thanh cong trong so mo hinh tot nhat tu {WEIGHTS_PATH}!")
    else:
        # Nếu chưa tìm thấy thì fallback thử file cũ
        fallback_h5 = os.path.join(PROJECT_DIR, 'final_fruit_model.h5')
        if os.path.exists(fallback_h5):
            model = tf.keras.models.load_model(fallback_h5)
            MODEL_LOADED = True
            print(f"[SUCCESS] Da nap mo hinh du phong tu {fallback_h5}!")
        else:
            print("[WARNING] Chua tim thay trong so mo hinh. Web se tam chay che do Mock.")
except Exception as e:
    print(f"[ERROR] Loi khoi tao mo hinh: {e}. Web se tam chay che do Mock.")

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/predict', methods=['POST'])
def predict():
    if 'file' not in request.files:
        return jsonify({'error': 'Khong tim thay file anh gui len.'})
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'Chua chon file anh nao.'})

    try:
        # Đọc ảnh an toàn trong bộ nhớ
        img = Image.open(io.BytesIO(file.read())).convert('RGB')
        
        if MODEL_LOADED and model is not None:
            # Tiền xử lý ảnh đúng chuẩn
            img_resized = img.resize((224, 224))
            # Chuyển thành numpy array thang đo [0, 255] (Model đã có tầng Lambda resnet_preprocess tự xử lý)
            img_array = np.array(img_resized, dtype=np.float32)
            img_array = np.expand_dims(img_array, axis=0)

            # Dự đoán
            predictions = model.predict(img_array, verbose=0)[0]
            predicted_class_idx = int(np.argmax(predictions))
            predicted_class = CLASSES[predicted_class_idx]
            confidence = float(predictions[predicted_class_idx]) * 100

            # Chi tiết phân bố xác suất của 6 lớp
            details = {CLASSES[i]: float(predictions[i]) * 100 for i in range(len(CLASSES))}
            source_info = "ResNet50 (best_model.weights.h5)"
        else:
            import time, random
            time.sleep(0.5)
            predicted_class = random.choice(CLASSES)
            confidence = random.uniform(92.0, 99.8)
            details = {cls: random.uniform(0.1, 3.0) for cls in CLASSES}
            details[predicted_class] = confidence
            source_info = "Mock Demonstration Mode"

        return jsonify({
            'success': True,
            'class': predicted_class,
            'confidence': confidence,
            'details': details,
            'model_source': source_info
        })
        
    except Exception as e:
        return jsonify({'error': f"Loi xu ly anh: {str(e)}"})

if __name__ == '__main__':
    port = 5000
    print(f"[INFO] Khoi dong server web tai: http://127.0.0.1:{port}")
    app.run(host='0.0.0.0', port=port, debug=False)
