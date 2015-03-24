var jsApiList = [
    'closeWindow',
    'onMenuShareAppMessage',
    'onMenuShareTimeline',
    'onMenuShareQQ',
    'onMenuShareWeibo'
];

wx.config({
    debug: <%= wxConfig.debug %>,
    appId: '<%= wxConfig.appId %>',
    timestamp: <%= wxConfig.timestamp %>,
    nonceStr: '<%= wxConfig.nonceStr %>',
    signature: '<%= wxConfig.signature %>',
    jsApiList: jsApiList
});

wx.ready(function () {
    var shareObj = {
        title: '<%= strings.UiShareTitle %>',
        desc: '<%= strings.UiShareDescription %>',
        link: '<%= wxConfig.shareLink %>',
        imgUrl: '<%= wxConfig.shareImageLink %>',
        trigger: function (res) {
            alertBox('start sharing...');
        },
        success: function (res) {
            alertBox('<%= strings.UiShareSuccessPrompt %>');
        },
        cancel: function (res) {
            alertBox('<%= strings.UiShareCancelPrompt %>');
        },
        fail: function (res) {
            alertBox('<%= strings.UiShareFailPrompt %>');
            console.log(JSON.stringify(res));
        }
    };

    wx.onMenuShareAppMessage(shareObj);
    wx.onMenuShareTimeline(shareObj);
    wx.onMenuShareWeibo(shareObj);
    wx.onMenuShareQQ(shareObj);
});

wx.error(function () {
    var xhr = new XMLHttpRequest();
    xhr.onreadystatechange = function () {
        if (xhr.readyState === 4) {
            var wxConfig = JSON.parse(xhr.responseText);
            wx.config({
                debug: <%= wxConfig.debug %>,
                appId: wxConfig.appId,
                timestamp: wxConfig.timestamp,
                nonceStr: wxConfig.nonceStr,
                signature: wxConfig.signature,
                jsApiList: jsApiList
            });
        }
    };
    xhr.open("POST", "<%= wxConfig.updateSignUrl %>", true);
    xhr.send(location.href.split('#')[0]);
});