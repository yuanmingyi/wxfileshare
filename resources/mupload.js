/******************************* functionalities for upload page **************************/

(function (window) {
    var document = window.document;
    var maxFilenameLength = 20;

    Element.prototype.attr = function (name, value) {
        var attr = {};
        if (typeof name === 'string') {
            if (typeof value === 'undefined') {
                return this.getAttribute(name);
            }
            attr[name] = value;
        } else {
            attr = name;
        }

        for (var key in attr) {
            if (attr.hasOwnProperty(key)) {
                this.setAttribute(key, attr[key]);
            }
        }

        return this;
    };

    Element.prototype.class = function (value) {
        if (typeof value === 'undefined') {
            return this.className;
        }
        this.className = value;
        return this;
    };

    Element.prototype.addClass = function (value) {
        this.className = this.className === '' ? value : this.className + ' ' + value;
        return this;
    };

    Element.prototype.removeClass = function (value) {
        this.className = this.className.replace(new RegExp('\b' + value + '\b'), '');
        this.className = this.className.trim().replace(/ +/, ' ');
        return this;
    };

    Element.prototype.append = function (ele) {
        this.appendChild(ele);
        return this;
    };

    Element.prototype.insert = function (ele) {
        this.insertBefore(ele, this.firstChild);
        return this;
    };

    Element.prototype.inner = function (innerHtml) {
        this.innerHTML = innerHtml;
        return this;
    }

    Element.prototype.rm = function (ele) {
        this.removeChild(ele);
        return this;
    }

    /*
    * select all the text within the given node
    */
    var selectText = function (p) {
        if (window.getSelection) {
            var selection = window.getSelection();
            selection.selectAllChildren(p);
        } else {
            var range = document.body.createTextRange();
            range.moveToElementText(p);
            range.select();
        }
    };

    /*
    * modify the shown file name to limit the characters within 15 (use ... to replace the middle part of the filename)
    */
    var limitName = function (filename) {
        if (filename.length > maxFilenameLength) {
            filename = filename.slice(0, 8) + '....' + filename.slice(-8);
        }
        return filename;
    };

    var popupWindow = (function () {
        var element = null;
        var p = null;

        var obj = {};

        obj.showSelected = function (text, fixedSize) {
            this.showMessage(text, fixedSize);
            selectText(p);
        };

        obj.showMessage = function (text, fixedSize) {
            element.class('hidden');
            p.textContent = text;
            if (fixedSize) {
                element.class('fixed-size');
            } else {
                element.class('auto-size');
            }
        };

        obj.initialize = function (id) {
            element = document.getElementById(id);
            p = element.getElementsByTagName('p')[0];
            element.parentNode.onclick = element.onclick = function () {
                element.class('hidden');
            };
        }

        return obj;
    })();

    var uploadList = (function () {
        var containerDiv = null;
        var list = null;
        var itemCount = 0;
        var items = {};

        var obj = {};

        function ListItem(li) {
            var id = currentId();
            this.li = li;
            this.id = id;
            this.ci_title = li.getElementsByClassName('ci-title')[0];
            this.title = document.createTextNode(limitName(this.filename()));
            this.ci_title.getElementsByTagName('span')[0].appendChild(this.title);
            this.ci_title.attr('href', 'javascript:onclick_fileitem("' + this.id + '")');
            this.p = li.getElementsByClassName('auto-select-text')[0];

            li.attr('id', id);
            items[id] = this;
            itemCount++;
        }

        ListItem.prototype.uploading = function () {
            this.li.class('collapse-item-uploading');
            list.insert(this.li);
        };

        ListItem.prototype.uploaded = function (obj) {
            this.li.class('collapse-item-folded');
            this.title.nodeValue = limitName(this.filename());
            this.p.textContent = obj.url;
            onclick_fileitem(this.id);
        };

        ListItem.prototype.updateProgress = function (event) {
            var filename = this.filename();
            if (event.lengthComputable) {
                var percentComplete = Math.round(event.loaded * 100 / event.total);
                this.title.nodeValue = '正在上传...: ' + limitName(filename) + ' ' + percentComplete.toString() + '%';
                this.ci_title.style.opacity = percentComplete / 100;
                // for ie
                this.ci_title.style.filter = 'alpha(opacity=' + percentComplete + ')';
            }
            else {
                this.title.nodeValue = limitName(filename) + ' ??%';
            }
        };

        ListItem.prototype.remove = function () {
            delete items[this.id];
            this.li.remove();
        };

        ListItem.prototype.filename = function () {
            return this.ci_title.attr('filename');
        };

        ListItem.prototype.link = function () {
            return this.p.textContent;
        };

        ListItem.prototype.isFolded = function () {
            return this.li.class() === 'collapse-item-folded';
        };

        ListItem.prototype.isUploading = function () {
            return this.li.class() === 'collapse-item-uploading';
        };

        ListItem.prototype.isUploaded = function () {
            return this.li.class() === 'collapse-item-folded'
                || this.li.class() === 'collapse-item-unfolded';
        };

        ListItem.prototype.fold = function () {
            this.li.class('collapse-item-folded');
        };

        ListItem.prototype.unfold = function () {
            this.li.class('collapse-item-unfolded');
        };

        ListItem.prototype.selectText = function () {
            selectText(this.p);
        };

        var currentId = function () {
            return 'file' + itemCount;
        };

        obj.initialize = function (id) {
            containerDiv = document.getElementById(id);
            list = containerDiv.getElementsByClassName('collapse-set')[0];
            for (var i = list.children.length - 1; i >= 0; i--) {
                var li = list.children[i];
                new ListItem(li);
            }
        };

        /*
        * add an uploaded item to the item list
        */
        obj.addListItem = function (filename) {
            // create HTML element
            var p = document.createElement('p').class('auto-select-text');
            var ci_title = document.createElement('a').class('ci-title').attr('filename', filename);
            ci_title.appendChild(document.createElement('span'));
            var ci_details = document.createElement('div').class('ci-details').append(p);
            var li = document.createElement('li').class('collapse-item-folded').append(ci_title).append(ci_details);

            return new ListItem(li);
        };

        obj.getListItemObj = function (id) {
            if (typeof items[id] === 'undefined') {
                return null;
            }

            return items[id];
        };

        obj.getAllLinks = function () {
            var links = [];
            var listItems = list.children;
            for (var i = 0; i < listItems.length; i++) {
                var item = items[listItems[i].id];
                if (item.isUploaded()) {
                    var filename = item.filename();
                    var link = item.link();
                    links.push({ name: filename, link: link });
                }
            }

            return links;
        };

        obj.foldAll = function () {
            Array.prototype.forEach.apply(list.getElementsByClassName('collapse-item-unfolded'), [function (e) {
                e.class('collapse-item-folded');
            } ]);
        };

        return obj;
    })();

    /*
    * initialize the DOM objects
    */
    window.onload = function () {
        var maxFileSize = parseInt(document.getElementById("maxFileSize").textContent);
        var form = document.getElementById("form0");
        var uploader = document.getElementById("uploader");

        popupWindow.initialize('popupWindow');
        uploadList.initialize('uploadList');

        uploader.onchange = function (ev) {
            if (uploader.value !== '' && !!uploader.files && uploader.files.length === 1) {
                if (uploader.files[0].size > maxFileSize) {
                    alertBox("请上传小于" + maxFileSize / 1024 / 1024 + "Mb的文件");
                    form.reset();
                    return;
                }

                var uid = document.getElementById("uid");
                form['uid'].value = uid.textContent;
                var newFile = uploadList.addListItem(uploader.files[0].name);

                var xhr = new XMLHttpRequest();
                if (xhr.upload) {
                    xhr.upload.addEventListener('progress', function (e) {
                        newFile.updateProgress(e);
                    }, false);
                }
                xhr.addEventListener('load', function (e) {
                    var obj = JSON.parse(e.target.responseText);
                    newFile.uploaded(obj);
                }, false);
                xhr.addEventListener('error', function (e) {
                    alertBox("文件上传失败，请重试");
                    newFile.remove();
                }, false);
                xhr.addEventListener('abort', function (e) {
                    newFile.remove();
                }, false);

                xhr.open("POST", "/upload", true);

                console.log(xhr.send(new FormData(form)));
                newFile.uploading();
                form.reset();
            }
        };
    };

    /*
    * handler for clicking upload button
    */
    window.onclick_add = function () {
        var uploader = document.getElementById("uploader");
        if (uploader.disabled) {
            alertBox('您的微信版本不支持上传文件，请点击菜单选择“在IE中打开”来进行操作');
        } else {
            uploader.click();
        }
    };

    window.onclick_all = function () {
        var allLinks = uploadList.getAllLinks();
        var text = [];
        for (var i = 0; i < allLinks.length; i++) {
            text.push(allLinks[i].name + ':\n' + allLinks[i].link);
        }
        if (text.length > 0) {
            popupWindow.showSelected(text.join('\n\n'), false);
        } else {
            alertBox('请先上传文件');
        }
    };

    window.onclick_close = function () {
        window.close();
    };

    window.alertBox = function (text) {
        popupWindow.showMessage(text, true);
    };

    window.onclick_fileitem = function (id) {
        var item = uploadList.getListItemObj(id);
        if (!item.isUploaded()) {
            return;
        }
        if (item.isFolded()) {
            uploadList.foldAll();
            item.unfold();
            item.selectText();
        } else {
            item.fold();
        }
    };
})(window);