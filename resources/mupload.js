/******************************* functionalities for upload page **************************/

(function (window) {
    var document = window.document;

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
        var maxFilenameLength = 20;
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
            p.innerText = text;
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

        obj.initialize = function (id) {
            containerDiv = document.getElementById(id);
            list = containerDiv.getElementsByClassName('collapse-set')[0];
        };

        /*
        * add an uploaded item to the item list
        */
        obj.addListItem = function (filename) {
            var listItem = {};

            // create HTML element
            var id = 'file' + itemCount;
            itemCount++;
            var p = document.createElement('p').class('auto-select-text');
            var title = document.createTextNode(limitName(filename));
            var ci_title = document.createElement('a').class('ci-title').attr('filename', filename);
            ci_title.appendChild(document.createElement('span')).appendChild(title);

            var ci_details = document.createElement('div').class('ci-details').append(p);
            var li = document.createElement('li').attr('id', id).class('collapse-item-folded').append(ci_title).append(ci_details);

            listItem.id = id;

            listItem.node = li;

            listItem.uploading = function () {
                li.class('collapse-item-uploading');
                list.insert(li);
            };

            listItem.uploaded = function (obj) {
                li.class('collapse-item-folded');
                ci_title.attr('href', 'javascript:onclick_fileitem("' + this.id + '")');
                title.nodeValue = limitName(filename);
                p.innerText = obj.url;
                onclick_fileitem(this.id);
            };

            listItem.updateProgress = function (event) {
                if (event.lengthComputable) {
                    var percentComplete = Math.round(event.loaded * 100 / event.total);
                    title.nodeValue = '正在上传...: ' + limitName(filename) + ' ' + percentComplete.toString() + '%';
                    ci_title.style.opacity = percentComplete / 100;
                    // for ie
                    ci_title.style.filter = 'alpha(opacity=' + percentComplete + ')';
                }
                else {
                    title.nodeValue = limitName(filename) + ' ??%';
                }
            };

            listItem.remove = function () {
                delete items[this.id];
                this.node.remove();
            };

            listItem.filename = function () {
                return ci_title.attr('filename');
            };

            listItem.link = function () {
                return p.innerText;
            };

            listItem.isFolded = function () {
                return li.class() === 'collapse-item-folded';
            }

            listItem.fold = function () {
                li.class('collapse-item-folded');
            }

            listItem.unfold = function () {
                li.class('collapse-item-unfolded');
            }

            listItem.selectText = function () {
                selectText(p);
            };

            items[id] = listItem;

            return listItem;
        };

        obj.getListItemObj = function (id) {
            if (typeof items[id] === 'undefined') {
                return null;
            }

            return items[id];
        };

        obj.getAllLinks = function () {
            var fileItems = list.children;
            var links = [];

            for (var i = 0; i < fileItems.length; i++) {
                var item = items[fileItems[i].id];
                var filename = item.filename();
                var link = item.link();
                links.push({ name: filename, link: link });
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

                xhr.send(new FormData(form));
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
        uploader.click();
    };

    window.onclick_all = function () {
        var allLinks = uploadList.getAllLinks();
        var text = [];
        for (var i = 0; i < allLinks.length; i++) {
            text.push(allLinks[i].name + ':\n' + allLinks[i].link);
        }
        if (text.length > 0) {
            popupWindow.showSelected(text.join('\n\n'), true);
        } else {
            alertBox('请先上传文件');
        }
    };

    window.onclick_close = function () {
        window.close();
    };

    window.alertBox = function (text) {
        popupWindow.showMessage(text, false);
    };

    window.onclick_fileitem = function (id) {
        var item = uploadList.getListItemObj(id);
        if (item.isFolded()) {
            uploadList.foldAll();
            item.unfold();
            item.selectText();
        } else {
            item.fold();
        }
    };

})(window);