// WecSocketコンストラクタ(自動的にコネクションを開こうとする)
var ws = new WebSocket('ws://localhost:8080', 'chat');

var btn = document.getElementById('btn');

ws.onopen = function () {
    console.log('[open]');

    btn.enable = true;
    btn.addEventListener('click', function () {
        if (btn.disable) {
            return;
        }
        var value = document.getElementById('mes').value;
        ws.send('abcdefghijklmnopqrstuvwsyz');
        //ws.send(value);
    });

    ws.onmessage = function (event) {
        var elm = document.createElement('li');
        elm.innerHTML = event.data;
        document.getElementById('result').appendChild(elm);
    };
};

ws.onerror = function (err) {
    console.log(err);
};

ws.onclose = function () {
    console.log('[close]');
    btn.disable = true;
};
