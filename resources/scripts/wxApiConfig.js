wx.ready(function () {
    alert("wx ready");
    wx.checkJsApi({
        jsApiList: [
            'closeWindow',
            'onMenuShareAppMessage',
            'onMenuShareTimeline',
            'onMenuShareQQ',
            'onMenuShareWeibo'
        ],
        success: function (res) {
            //alertBox("success: " + JSON.stringify(res));
            alert("check js api success");
        }
    });
});

wx.error(function (err) {
    alert("error: " + JSON.stringify(err));
    var xhr = new XMLHttpRequest();
    xhr.onreadystatechange = function () {
        if (xhr.readyState === 4) {
            var wxConfig = JSON.parse(xhr.responseText);
            wx.config({
                debug: debugWx,
                appId: wxConfig.appId,
                timestamp: wxConfig.timestamp,
                nonceStr: wxConfig.nonceStr,
                signature: wxConfig.signature,
                jsApiList: [
                    'checkJsApi',
                    'onMenuShareTimeline',
                    'onMenuShareAppMessage',
                    'onMenuShareQQ',
                    'onMenuShareWeibo',
                    'closeWindow'
                ]
            });
        }
    };
    //xhr.open("POST", "<%= wxConfig.updateSignUrl %>", true);
    //xhr.send(location.href);
});

window.addEventListener('load', function () {
    alert("start to add listener...");
    wx.onMenuShareAppMessage({
        title: 'shareApp', // '<%= strings.UiShareTitle %>',
        desc: '<%= strings.UiShareDescription %>',
        link: '<%= wxConfig.shareLink %>',
        imgUrl: '<%= wxConfig.shareImageLink %>',
        trigger: function (res) {
            alert('start sharing...');
        },
        success: function (res) {
            alert('<%= strings.UiShareSuccessPrompt %>');
        },
        cancel: function (res) {
            alert('<%= strings.UiShareCancelPrompt %>');
        },
        fail: function (res) {
            alert('<%= strings.UiShareFailPrompt %>');
        }
    });

    wx.onMenuShareTimeline({
        title: 'shareTimeLine', // '<%= strings.UiShareTitle %>',
        link: '<%= wxConfig.shareLink %>',
        imgUrl: '<%= wxConfig.shareImageLink %>',
        trigger: function (res) {
            alert('start sharing...');
        },
        success: function (res) {
            alert('<%= strings.UiShareSuccessPrompt %>');
        },
        cancel: function (res) {
            alert('<%= strings.UiShareCancelPrompt %>');
        },
        fail: function (res) {
            alert('<%= strings.UiShareFailPrompt %>');
        }
    });

    wx.onMenuShareWeibo({
        title: 'shareWeibo', // '<%= strings.UiShareTitle %>',
        desc: '<%= strings.UiShareDescription %>',
        link: '<%= wxConfig.shareLink %>',
        imgUrl: '<%= wxConfig.shareImageLink %>',
        trigger: function (res) {
            alert('start sharing...');
        },
        success: function (res) {
            alert('<%= strings.UiShareSuccessPrompt %>');
        },
        cancel: function (res) {
            alert('<%= strings.UiShareCancelPrompt %>');
        },
        fail: function (res) {
            alert('<%= strings.UiShareFailPrompt %>');
        }
    });

    wx.onMenuShareQQ({
        title: 'shareQQ', // '<%= strings.UiShareTitle %>',
        desc: '<%= strings.UiShareDescription %>',
        link: '<%= wxConfig.shareLink %>',
        imgUrl: '<%= wxConfig.shareImageLink %>',
        success: function (res) {
            alert('<%= strings.UiShareSuccessPrompt %>');
        },
        cancel: function (res) {
            alert('<%= strings.UiShareCancelPrompt %>');
        },
        fail: function (res) {
            alert('<%= strings.UiShareFailPrompt %>');
        }
    });

    var alert1 = function () {
        alertBox.apply(null, arguments);
    }
});