window.onload = function() {
    var app = new PIXI.Application(800, 600, { antialias: true });
    document.body.appendChild(app.view);

    app.stage.interactive = true;

    var graphics = new PIXI.Graphics();

    // set a fill and line style
    graphics.beginFill(0xFF3300);
    graphics.lineStyle(10, 0xffd900, 1);

    // draw a shape
    graphics.moveTo(50,50);
    graphics.lineTo(250, 50);
    graphics.lineTo(100, 100);
    graphics.lineTo(250, 220);
    graphics.lineTo(50, 220);
    graphics.lineTo(50, 50);
    graphics.endFill();

    app.stage.addChild(graphics);
}

