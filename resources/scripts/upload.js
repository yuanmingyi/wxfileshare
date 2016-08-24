/******************************* functionalities for upload page **************************/

/*
* initialize the DOM objects
*/
var initDom = function () {
    var maxFileSize = parseInt(document.getElementById("maxFileSize").textContent);
    var form = document.getElementById("form0");
    var uploader = document.getElementById("uploader");
    var hintText = document.getElementById("hint").innerText;

    uploader.onchange = function (ev) {
        if (uploader.value !== '' && !!uploader.files && uploader.files.length === 1) {
            if (uploader.files[0].size > maxFileSize) {
                alert("请上传小于" + maxFileSize / 1024 / 1024 + "Mb的文件");
                form.reset();
                return;
            }

            if (uploader.files[0].size === 0) {
                alert("请上传非空文件");
                form.reset();
                return;
            }

            var uploadButton = document.getElementById("uploadButton");
            var hintLabel = document.getElementById("hint");
            var uploadContainer = document.getElementById("uploadContainer");
            var loadingText = document.getElementById("loadingText");
            var uid = document.getElementById("uid");
            var xhr = new XMLHttpRequest();
            xhr.open("POST", "/upload", true);
            xhr.onreadystatechange = function () {
                if (xhr.readyState == 4) {
                    uploadButton.onclick = upload;
                    clearInterval(timer);
                    hintLabel.innerText = hintText;
                    if (xhr.status == 200) {
                        var obj = JSON.parse(xhr.responseText);
                        addFileUploaded(uploadContainer, obj);
                    } else {
                        alert("文件上传失败，请重试");
                    }
                    form.reset();
                }
            };
            form['uid'].value = uid.textContent;
            xhr.send(new FormData(form));
            uploadButton.onclick = "";
            var timer = setIntervalChangedText(hintLabel, "文件上传中，请耐心等待");
        }
    };
};

/*
* handler for clicking upload button
*/
var upload = function () {
    var uploader = document.getElementById("uploader");
    uploader.click();
};

/*
* compose the loading animation
*/
function setIntervalChangedText(textControl, textPrefix) {
    var loadingSign = ["·", "·", "·", "·", "·", " "];
    var len = loadingSign.length;
    var pos = len - 1;
    textControl.innerText = textPrefix + loadingSign.join("");
    return setInterval(function () {
        loadingSign[pos] = "·";
        pos = (pos - 1 + len) % len;
        loadingSign[pos] = " ";
        textControl.innerText = textPrefix + loadingSign.join("");
    }, 1000);
}

/*
* add an uploaded item to the item list
*/
function addFileUploaded(container, obj) {
    var div = addElement('div');
    var url = obj.url.slice(0, obj.url.indexOf(' '));
    div.appendChild(addElement('span', '上传文件(24小时有效)：'));
    div.appendChild(addElement('span', '<a target="_blank" href="' + url + '">' + limitName(obj.filename) + '</a>'));
    div.appendChild(addElement('span', '&nbsp<a href="javascript:showQr(\'' + url + '\')">查看二维码</a>'));

    if (container.firstElementChild) {
        container.insertBefore(div, container.firstElementChild);
    } else {
        container.appendChild(div);
    }
}


/*
* generate QR image and show it as the pop-up window
*/
var showQr = (function () {
    var qrcodedraw = new qrcodelib.qrcodedraw();
    //triggered errors will throw
    qrcodedraw.errorBehavior.length = false;

    return function (url, container) {
        var qrImg = container || document.createElement('canvas');
        qrcodedraw.draw(qrImg, url, function (error, canvas) {
            if (error) {
                alert('生成二维码失败');
                qrImg.style.display = 'none';
            }
        });
        if (!container) {
            var notify = new Notify(qrImg, { width: qrImg.width, height: qrImg.height });
        }
    }
})();


/************************************ utilites **********************************/

/*
* add an element with specified tag and inner HTML
*/
function addElement(tag, innerHtml) {
    var ele = document.createElement(tag);
    if (innerHtml) {
        ele.innerHTML = innerHtml;
    }
    return ele;
}

/*
* modify the shown file name to limit the characters within 15 (use ... to replace the middle part of the filename)
*/
function limitName(filename) {
    var maxFilenameLength = 20;
    if (filename.length > maxFilenameLength) {
        filename = filename.slice(0, 8) + '....' + filename.slice(-8);
    }
    return filename;
}

/*
* create a transparent cover placed on the page
*/
var getCover = (function () {
    var _cover = null;
    var showing = false;
    var _init = function () {
        _cover = document.createElement('div');
        _cover.id = 'cover';
        _cover.style.position = 'absolute';
        _cover.style.zIndex = 1;
        _resize();
        _cover.style.top = '0px';
        _cover.style.left = '0px';
        _cover.style.background = '#333333';
        _cover.style.filter = 'alpha(opacity=40)';
        _cover.style.opacity = '0.40';
        _cover.style.padding = '0px';
        _cover.style.margin = '0px';
        _cover.style.border = '0px';

        if (window.addEventListener) {
            window.addEventListener('resize', _resize, false);
        } else if (window.attachEvent) {
            window.attachEvent('onresize', _resize);
        }
    };

    var _resize = function () {
        _cover.style.width = Math.max(document.body.scrollWidth, document.documentElement.scrollWidth) + 'px';
        _cover.style.height = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight) + 'px';
    };

    return function () {
        if (!_cover) {
            _init();
        }
        return {
            element: function () {
                return _cover;
            },
            show: function () {
                if (!showing) {
                    document.body.appendChild(_cover);
                    showing = true;
                }
            },
            hide: function () {
                if (showing) {
                    document.body.removeChild(_cover);
                    showing = false;
                }
            },
            isShowing: function () {
                return showing;
            }
        };
    }
})();

/*
* create a pop-up window for showing notification
*/
function Notify(content, options) {
    // default parameters
    this.id = 'notify';
    this.width = 250;
    this.height = 250;
    this.vPos = 'center';
    this.hPos = 'center';
    this.background = '#FFFFFF';
    this.padding = '5px';

    // load parameters from options
    if (typeof options === 'object' && !!options) {
        this.id = options.id || this.id;
        this.width = options.width || this.width;
        this.height = options.height || this.height;
        this.vPos = options.vPos || this.vPos;
        this.hPos = options.hPos || this.hPos;
        this.background = options.background || this.background;
        this.padding = options.padding || this.padding;
    }

    if (!!document.getElementById(this.id)) {
        console.log("notify already exists!");
        return;
    }

    var div = document.createElement('div');
    div.id = this.id;
    div.style.position = 'absolute';
    div.style.zIndex = 2;
    div.style.width = this.width + 'px';
    div.style.height = this.height + 'px';

    this.scrollHandler(div);

    div.style.background = this.background;
    div.style.padding = this.padding;

    if (window.addEventListener) {
        window.addEventListener('scroll', this.scrollHandler, false);
    } else if (window.attachEvent) {
        window.attachEvent('onscroll', this.scrollHandler);
    }

    var cover = getCover();
    var that = this;
    cover.element().onclick = function () {
        if (cover.isShowing()) {
            that.close();
        }
    };
    div.onclick = this.close;
    cover.show();
    div.appendChild(content);
    document.body.appendChild(div);
}

Notify.prototype.scrollHandler = function (div) {
    var div = div || document.getElementById(this.id);
    if (!!div) {
        if (this.vPos === 'top') {
            div.style.top = document.body.scrollTop;
        } else if (this.vPos === 'center') {
            div.style.top = (document.body.scrollTop + document.body.clientHeight / 2 - this.height / 2) + 'px';
        } else {
            div.style.top = (document.body.scrollTop + document.body.clientHeight - this.height) + 'px';
        }

        if (this.hPos === 'left') {
            div.style.left = document.body.scrollLeft;
        } else if (this.hPos === 'center') {
            div.style.left = (document.body.scrollLeft + document.body.clientWidth / 2 - this.width / 2) + 'px';
        } else {
            div.style.left = (document.body.scrollLeft + document.body.clientWidth - this.width) + 'px';
        }
    }
};

Notify.prototype.close = function () {
    if (window.removeEventListener) {
        window.removeEventListener('scroll', this.scrollHandler, false);
    } else if (window.detachEvent) {
        window.detachEvent('onscroll', this.scrollHandler);
    }

    var div = document.getElementById(this.id);
    if (!!div) {
        document.body.removeChild(div);
        console.log('notify removed');
    }

    getCover().hide();
};