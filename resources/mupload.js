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
            p.onblur = element.onclick = function () {
                element.class('hidden');
            };
        }

        return obj;
    })();

    var uploadList = (function () {
        var containerDiv = null;
        var list = null;
        var itemCount = 0;
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
            var ci_title = document.createElement('a')
            .class('ci-title')
            .attr('filename', filename)
            .inner('<span>' + limitName(filename) + '</span>');
            var ci_details = document.createElement('div')
            .class('ci-details')
            .append(p);
            var li = document.createElement('li')
            .attr('id', id)
            .class('collapse-item-folded')
            .append(ci_title)
            .append(ci_details);

            listItem.id = id;
            listItem.uploading = function () {
                list.insert(li);
            };

            listItem.uploaded = function (obj) {
                ci_title.attr('href', 'javascript:onclick_fileitem("' + this.id + '")');
                p.innerText = obj.url;
            };

            listItem.remove = function () {
                list.rm(li);
            };

            listItem.filename = function () {
                return ci_title.attr('filename');
            };

            listItem.link = function () {
                return p.innerText;
            };

            return listItem;
        };

        obj.getAllLinks = function () {
            var fileItems = list.children;
            var links = [];

            for (var i = 0; i < fileItems.length; i++) {
                var fileItem = fileItems[i];
                var filename = fileItem.getElementsByClassName('ci-title')[0].attr('filename');
                var link = fileItem.getElementsByClassName('auto-select-text')[0].innerText;
                links.push({ name: filename, link: link });
            }

            return links;
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
                var xhr = new XMLHttpRequest();
                xhr.open("POST", "/upload", true);
                xhr.onreadystatechange = function () {
                    if (xhr.readyState == 4) {
                        if (xhr.status == 200) {
                            var obj = JSON.parse(xhr.responseText);
                            newFile.uploaded(obj);
                        } else {
                            alertBox("文件上传失败，请重试");
                            newFile.remove();
                        }
                    }
                };

                form['uid'].value = uid.textContent;
                xhr.send(new FormData(form));
                var newFile = uploadList.addListItem(uploader.files[0].name);
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
        popupWindow.showSelected(text.join('\n\n'), true);
    };

    window.onclick_close = function () {
        window.close();
    };

    window.alertBox = function (text) {
        popupWindow.showMessage(text, false);
    };

    window.onclick_fileitem = function (id) {
        var li = document.getElementById(id);
        if (li.class() === 'collapse-item-folded') {
            li.class('collapse-item-unfolded');
            selectText(li.getElementsByTagName('p')[0]);
        } else {
            li.class('collapse-item-folded');
        }
    };

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

})(window);