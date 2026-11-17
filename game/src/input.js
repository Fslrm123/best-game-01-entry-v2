// Keyboard and mouse state, converted into the logical 1280x720 arena.
// The game reads one plain object per step: { moveX, moveY, aimX, aimY,
// firing, pressed } so the autopilot can drive the same shape.

export class Input {
  constructor(canvas, arenaWidth, arenaHeight) {
    this.canvas = canvas;
    this.arenaWidth = arenaWidth;
    this.arenaHeight = arenaHeight;
    this.keys = new Set();
    this.pressedKeys = new Set();
    this.mouseX = arenaWidth / 2;
    this.mouseY = arenaHeight / 2 - 120;
    this.mouseDown = false;
    this.clicked = null;
    this._onKeyDown = (event) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(event.key)) event.preventDefault();
      if (!event.repeat) this.pressedKeys.add(event.code);
      this.keys.add(event.code);
    };
    this._onKeyUp = (event) => this.keys.delete(event.code);
    this._onMouseMove = (event) => {
      const rect = canvas.getBoundingClientRect();
      const scale = Math.min(rect.width / arenaWidth, rect.height / arenaHeight);
      const offsetX = (rect.width - arenaWidth * scale) / 2;
      const offsetY = (rect.height - arenaHeight * scale) / 2;
      this.mouseX = (event.clientX - rect.left - offsetX) / scale;
      this.mouseY = (event.clientY - rect.top - offsetY) / scale;
    };
    this._onMouseDown = (event) => {
      if (event.button === 0) {
        this.mouseDown = true;
        this._onMouseMove(event);
        this.clicked = { x: this.mouseX, y: this.mouseY };
      }
    };
    this._onMouseUp = (event) => {
      if (event.button === 0) this.mouseDown = false;
    };
    this._onBlur = () => {
      this.keys.clear();
      this.mouseDown = false;
    };
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    canvas.addEventListener('mousemove', this._onMouseMove);
    canvas.addEventListener('mousedown', this._onMouseDown);
    window.addEventListener('mouseup', this._onMouseUp);
    window.addEventListener('blur', this._onBlur);
  }

  isDown(code) {
    return this.keys.has(code);
  }

  wasPressed(code) {
    return this.pressedKeys.has(code);
  }

  // One step's worth of play input, in arena coordinates.
  read() {
    let moveX = 0;
    let moveY = 0;
    if (this.isDown('KeyA') || this.isDown('ArrowLeft')) moveX -= 1;
    if (this.isDown('KeyD') || this.isDown('ArrowRight')) moveX += 1;
    if (this.isDown('KeyW') || this.isDown('ArrowUp')) moveY -= 1;
    if (this.isDown('KeyS') || this.isDown('ArrowDown')) moveY += 1;
    const length = Math.hypot(moveX, moveY);
    if (length > 0) {
      moveX /= length;
      moveY /= length;
    }
    return {
      moveX,
      moveY,
      aimX: this.mouseX,
      aimY: this.mouseY,
      firing: this.mouseDown || this.isDown('Space'),
      pressed: this.pressedKeys,
      clicked: this.clicked,
    };
  }

  // Call once per rendered frame: edges and clicks live for one frame only.
  endFrame() {
    this.pressedKeys.clear();
    this.clicked = null;
  }
}
