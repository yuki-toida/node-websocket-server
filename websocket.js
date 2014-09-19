// WecSocketコンストラクタ(自動的にコネクションを開こうとする)
var ws = new WebSocket('ws://localhost:8080', 'chat');

var btn = document.getElementById('btn');

ws.onopen = function () {
    console.log('[open]');

    btn.addEventListener('click', function () {
        var value = document.getElementById('mes').value;
        ws.send('y.toida');
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
};
