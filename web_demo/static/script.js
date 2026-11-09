const uploadArea = document.getElementById('upload-area');
const fileInput = document.getElementById('file-input');
const imagePreview = document.getElementById('image-preview');
const uploadPlaceholder = document.getElementById('upload-placeholder');
const predictBtn = document.getElementById('predict-btn');

const emptyState = document.getElementById('empty-state');
const loadingState = document.getElementById('loading');
const resultContainer = document.getElementById('result-container');

const resultClass = document.getElementById('result-class');
const resultConfidence = document.getElementById('result-confidence');
const detailsList = document.getElementById('details-list');

let selectedFile = null;

// Xử lý sự kiện click để chọn file
uploadArea.addEventListener('click', () => {
    fileInput.click();
});

// Xử lý khi file được chọn
fileInput.addEventListener('change', (e) => {
    handleFile(e.target.files[0]);
});

// Xử lý Drag & Drop
uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.style.backgroundColor = '#e8f5e9';
});

uploadArea.addEventListener('dragleave', (e) => {
    e.preventDefault();
    uploadArea.style.backgroundColor = '#f9fbf9';
});

uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.style.backgroundColor = '#f9fbf9';
    if (e.dataTransfer.files.length > 0) {
        handleFile(e.dataTransfer.files[0]);
    }
});

function handleFile(file) {
    if (!file || !file.type.startsWith('image/')) {
        alert('Vui lòng chọn một file hình ảnh!');
        return;
    }
    
    selectedFile = file;

    // Đọc và hiển thị ảnh
    const reader = new FileReader();
    reader.onload = (e) => {
        imagePreview.src = e.target.result;
        imagePreview.style.display = 'block';
        uploadPlaceholder.style.display = 'none';
        predictBtn.disabled = false;
        
        // Reset output section
        emptyState.classList.remove('hidden');
        resultContainer.classList.add('hidden');
        loadingState.classList.add('hidden');
    };
    reader.readAsDataURL(file);
}

// Gửi ảnh lên server khi bấm nút
predictBtn.addEventListener('click', async () => {
    if (!selectedFile) return;

    // Cập nhật UI sang trạng thái loading
    emptyState.classList.add('hidden');
    resultContainer.classList.add('hidden');
    loadingState.classList.remove('hidden');
    predictBtn.disabled = true;

    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
        const response = await fetch('/predict', {
            method: 'POST',
            body: formData
        });

        const data = await response.json();

        if (data.error) {
            alert('Lỗi: ' + data.error);
            resetUI();
            return;
        }

        displayResult(data);

    } catch (error) {
        alert('Không thể kết nối đến server: ' + error.message);
        resetUI();
    }
});

function displayResult(data) {
    // Ẩn loading, hiện kết quả
    loadingState.classList.add('hidden');
    resultContainer.classList.remove('hidden');
    predictBtn.disabled = false;

    // Cập nhật kết quả chính
    resultClass.innerText = formatClassName(data.class);
    resultConfidence.innerText = data.confidence.toFixed(2);

    // Đổi màu nếu là đồ hỏng (rotten)
    const mainResultBox = document.querySelector('.main-result');
    if (data.class.toLowerCase().includes('rotten')) {
        mainResultBox.style.backgroundColor = '#ffebee';
        resultClass.style.color = '#c62828';
        document.querySelector('.confidence-badge').style.backgroundColor = '#c62828';
    } else {
        mainResultBox.style.backgroundColor = '#e8f5e9';
        resultClass.style.color = '#2e7d32';
        document.querySelector('.confidence-badge').style.backgroundColor = '#2e7d32';
    }

    // Render danh sách chi tiết xác suất
    detailsList.innerHTML = '';
    
    // Sort details by probability descending
    const sortedDetails = Object.entries(data.details).sort((a, b) => b[1] - a[1]);

    for (const [cls, prob] of sortedDetails) {
        const li = document.createElement('li');
        
        const nameSpan = document.createElement('span');
        nameSpan.innerText = formatClassName(cls);
        nameSpan.style.width = '120px';

        const barContainer = document.createElement('span');
        barContainer.className = 'bar-container';
        
        const barFill = document.createElement('span');
        barFill.className = 'bar-fill';
        barFill.style.width = `${prob}%`;
        if (cls.toLowerCase().includes('rotten')) {
            barFill.style.backgroundColor = '#e57373';
        }
        barContainer.appendChild(barFill);

        const probSpan = document.createElement('span');
        probSpan.innerText = `${prob.toFixed(1)}%`;
        probSpan.style.width = '50px';
        probSpan.style.textAlign = 'right';

        li.appendChild(nameSpan);
        li.appendChild(barContainer);
        li.appendChild(probSpan);

        detailsList.appendChild(li);
    }
}

function resetUI() {
    loadingState.classList.add('hidden');
    emptyState.classList.remove('hidden');
    predictBtn.disabled = false;
}

// Hàm format tên class cho đẹp (VD: 'rottenapples' -> 'Rotten Apples')
function formatClassName(str) {
    if (str.startsWith('Mock:')) return str; // Bỏ qua nếu là mock
    
    let formatted = str;
    if (str.includes('fresh')) formatted = str.replace('fresh', 'Fresh ');
    if (str.includes('rotten')) formatted = str.replace('rotten', 'Rotten ');
    
    // Viết hoa chữ cái đầu của mỗi từ
    return formatted.replace(/\b\w/g, l => l.toUpperCase());
}
