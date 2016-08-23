wx.ready(function () {
    alert(JSON.stringify(wx.wjgxShareData));
    wx.onMenuShareAppMessage(wx.wjgxShareData);
    wx.onMenuShareTimeline(wx.wjgxShareData);
    wx.onMenuShareWeibo(wx.wjgxShareData);
    wx.onMenuShareQQ(wx.wjgxShareData);
});

wx.error(function (err) {
    alert("error: " + JSON.stringify(err));
});
