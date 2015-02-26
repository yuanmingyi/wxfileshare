window.onload = function () {
    var maxFileSize = parseInt(document.getElementById("maxFileSize").innerText);
    var form = document.getElementById("form0");
    var uploader = document.getElementById("uploader");
    uploader.onchange = function (ev) {
        if (uploader.value !== '' && !!uploader.files && uploader.files.length === 1) {
            if (uploader.files[0].size > maxFileSize) {
                alert("请上传小于" + maxFileSize / 1024 / 1024 + "Mb的文件");
                form.reset();
                return;
            }

            var uploadButton = document.getElementById("uploadButton");
            var hintLabel = document.getElementById("hint");
            var uploadContainer = document.getElementById("uploadContainer");
            var loadingText = document.getElementById("loadingText");
            var xhr = new XMLHttpRequest();
            xhr.open("POST", "/upload", true);
            xhr.onreadystatechange = function () {
                if (xhr.readyState == 4) {
                    uploadButton.onclick = upload;
                    clearInterval(timer);
                    hintLabel.innerText = "请点击图标上传文件";
                    if (xhr.status == 200) {
                        var obj = JSON.parse(xhr.responseText);
                        addFileUploaded(uploadContainer, obj);
                    } else {
                        alert("文件上传失败，请重试");
                    }
                    form.reset();
                }
            };
            xhr.send(new FormData(form));
            uploadButton.onclick = "";
            var timer = setIntervalChangedText(hintLabel, "文件上传中，请耐心等待");
        }
    };
};

function upload() {
    var uploader = document.getElementById("uploader");
    uploader.click();
}

function setIntervalChangedText(textControl, textPrefix) {
    var loadingSign = [".", ".", ".", ".", ".", " "];
    var len = loadingSign.length;
    var pos = len - 1;
    textControl.innerText = textPrefix + loadingSign.join("");
    return setInterval(function () {
        loadingSign[pos] = ".";
        pos = (pos - 1 + len) % len;
        loadingSign[pos] = " ";
        textControl.innerText = textPrefix + loadingSign.join("");
    }, 1000);
}

function addFileUploaded(container, obj) {
    var div = addElement('div');
    div.appendChild(addElement('span', '上传文件：'));
    div.appendChild(addElement('span', obj.filename));
    div.appendChild(addElement('br'));
    div.appendChild(addElement('span', '下载URL（24小时有效）：'));
    div.appendChild(addElement('span', '<a target="_blank" href="' + obj.url + '">' + obj.url + '</a>'));
    if (container.firstElementChild) {
        container.insertBefore(div, container.firstElementChild);
    } else {
        container.appendChild(div);
    }
}

function addElement(tag, innerHtml) {
    var ele = document.createElement(tag);
    if (innerHtml) {
        ele.innerHTML = innerHtml;
    }
    return ele;
}