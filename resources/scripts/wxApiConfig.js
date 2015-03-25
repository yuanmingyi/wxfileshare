wx.ready(function () {
    wx.checkJsApi({
      jsApiList: jsApiList,
      success: function (res) {
        alertBox(JSON.stringify(res));
      }
    });
});

wx.error(function () {
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
                jsApiList: jsApiList
            });
        }
    };
    //xhr.open("POST", "<%= wxConfig.updateSignUrl %>", true);
    xhr.open("POST", "http://wxfileshare.azurewebsites.net/updateConfig", true);
    xhr.send(location.href);
});

window.onload = function () {
    var shareObj = {
        title: 'test', //'<%= strings.UiShareTitle %>',
        desc: 'test', //'<%= strings.UiShareDescription %>',
        link: 'http://wxfileshare.azurewebsites.net', //'<%= wxConfig.shareLink %>',
        imgUrl: 'http://wxfileshare.azurewebsites.net/resources/upload-icon.png', //'<%= wxConfig.shareImageLink %>',
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
};