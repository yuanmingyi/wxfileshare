wx.ready(function () {
    wx.checkJsApi({
        jsApiList: [
            'closeWindow',
            'onMenuShareAppMessage',
            'onMenuShareTimeline',
            'onMenuShareQQ',
            'onMenuShareWeibo'
        ],
        success: function (res) {
            alertBox(JSON.stringify(res));
        }
    });
});

wx.error(function (err) {
    alert(JSON.stringify(err));
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
                    'hideMenuItems',
                    'showMenuItems',
                    'hideAllNonBaseMenuItem',
                    'showAllNonBaseMenuItem',
                    'translateVoice',
                    'startRecord',
                    'stopRecord',
                    'onRecordEnd',
                    'playVoice',
                    'pauseVoice',
                    'stopVoice',
                    'uploadVoice',
                    'downloadVoice',
                    'chooseImage',
                    'previewImage',
                    'uploadImage',
                    'downloadImage',
                    'getNetworkType',
                    'openLocation',
                    'getLocation',
                    'hideOptionMenu',
                    'showOptionMenu',
                    'closeWindow',
                    'scanQRCode',
                    'chooseWXPay',
                    'openProductSpecificView',
                    'addCard',
                    'chooseCard',
                    'openCard'
                ]
            });
        }
    };
    //xhr.open("POST", "<%= wxConfig.updateSignUrl %>", true);
    //xhr.send(location.href);
});

window.addEventListener('load', function () {
    wx.onMenuShareAppMessage({
        title: '<%= strings.UiShareTitle %>',
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
        title: '<%= strings.UiShareTitle %>',
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
        title: '<%= strings.UiShareTitle %>',
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
        title: '<%= strings.UiShareTitle %>',
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
});