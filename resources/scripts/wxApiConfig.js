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
            //alertBox("success: " + JSON.stringify(res));
        }
    });
});

wx.error(function (err) {
    alertBox("error: " + JSON.stringify(err));
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
        title: 'shareApp', // '<%= strings.UiShareTitle %>',
        desc: '<%= strings.UiShareDescription %>',
        link: '<%= wxConfig.shareLink %>',
        imgUrl: '<%= wxConfig.shareImageLink %>',
        trigger: function (res) {
            alert('start sharing...');
        },
        success: function (res) {
            alert1('<%= strings.UiShareSuccessPrompt %>');
        },
        cancel: function (res) {
            alert1('<%= strings.UiShareCancelPrompt %>');
        },
        fail: function (res) {
            alert1('<%= strings.UiShareFailPrompt %>');
        }
    });

    wx.onMenuShareTimeline({
        title: 'shareTimeLine', // '<%= strings.UiShareTitle %>',
        link: '<%= wxConfig.shareLink %>',
        imgUrl: '<%= wxConfig.shareImageLink %>',
        trigger: function (res) {
            alert1('start sharing...');
        },
        success: function (res) {
            alert1('<%= strings.UiShareSuccessPrompt %>');
        },
        cancel: function (res) {
            alert1('<%= strings.UiShareCancelPrompt %>');
        },
        fail: function (res) {
            alert1('<%= strings.UiShareFailPrompt %>');
        }
    });

    wx.onMenuShareWeibo({
        title: 'shareWeibo', // '<%= strings.UiShareTitle %>',
        desc: '<%= strings.UiShareDescription %>',
        link: '<%= wxConfig.shareLink %>',
        imgUrl: '<%= wxConfig.shareImageLink %>',
        trigger: function (res) {
            alert1('start sharing...');
        },
        success: function (res) {
            alert1('<%= strings.UiShareSuccessPrompt %>');
        },
        cancel: function (res) {
            alert1('<%= strings.UiShareCancelPrompt %>');
        },
        fail: function (res) {
            alert1('<%= strings.UiShareFailPrompt %>');
        }
    });

    wx.onMenuShareQQ({
        title: 'shareQQ', // '<%= strings.UiShareTitle %>',
        desc: '<%= strings.UiShareDescription %>',
        link: '<%= wxConfig.shareLink %>',
        imgUrl: '<%= wxConfig.shareImageLink %>',
        success: function (res) {
            alert1('<%= strings.UiShareSuccessPrompt %>');
        },
        cancel: function (res) {
            alert1('<%= strings.UiShareCancelPrompt %>');
        },
        fail: function (res) {
            alert1('<%= strings.UiShareFailPrompt %>');
        }
    });

    var alert1 = function () {
        alertBox.apply(null, arguments);
    }
});