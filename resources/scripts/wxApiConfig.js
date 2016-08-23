wx.ready(function () {
    alert("wx ready");
    wx.onMenuShareAppMessage(wx.wjgxShareData);
    wx.onMenuShareTimeline(wx.wjgxShareData);
    wx.onMenuShareWeibo(wx.wjgxShareData);
    wx.onMenuShareQQ(wx.wjgxShareData);
});

wx.error(function (err) {
    alert("error: " + JSON.stringify(err));
});
