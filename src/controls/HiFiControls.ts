/**
 * The `HiFiControls` class allows developers to more quickly write an application that requires a user
 * to navigate around a 2D or 3D environment.
 * @packageDocumentation
 */

const LEFT_ARROW_KEY_CODE = "ArrowLeft";
const UP_ARROW_KEY_CODE = "ArrowUp";
const RIGHT_ARROW_KEY_CODE = "ArrowRight";
const DOWN_ARROW_KEY_CODE = "ArrowDown";
const W_KEY_CODE = "KeyW";
const A_KEY_CODE = "KeyA";
const S_KEY_CODE = "KeyS";
const D_KEY_CODE = "KeyD";
const Q_KEY_CODE = "KeyQ";
const E_KEY_CODE = "KeyE";

class HiFiControls {
    private _mouseEventCache: Array<any>;
    private _leftClickStartPositionPX: any;
    private _rightClickStartPositionPX: any;
    private _lastLeftDragPosition: any;
    private _lastRightDragPosition: any;
    private _lastDistanceBetweenLeftClickEvents: any;
    private _lastDistanceBetweenRightClickEvents: any;
    private _lastDistanceBetweenTouchPoints: any;
    private _lastAngleBetweenTouchPoints: any;

    onCanvasDown: Function;
    onCanvasMove: Function;
    onLeftDrag: Function;
    onRightDrag: Function;
    onPinch: Function;
    onRotate: Function;
    onClick: Function;
    onWheel: Function;

    private _keyboardEventCache: Array<any>;
    onTurnLeftKeyDown: Function;
    onTurnRightKeyDown: Function;
    onMoveForwardKeyDown: Function;
    onMoveBackwardKeyDown: Function;
    onStrafeLeftKeyDown: Function;
    onStrafeRightKeyDown: Function;
    onTurnLeftKeyUp: Function;
    onTurnRightKeyUp: Function;
    onMoveForwardKeyUp: Function;
    onMoveBackwardKeyUp: Function;
    onStrafeLeftKeyUp: Function;
    onStrafeRightKeyUp: Function;

    constructor({ mainAppElement }: { mainAppElement: any }) {
        // START Mouse Event Code
        this._mouseEventCache = [];
        this._leftClickStartPositionPX = { x: 0.0, y: 0.0 };
        this._rightClickStartPositionPX = { x: 0.0, y: 0.0 };
        this._lastLeftDragPosition = null;
        this._lastRightDragPosition = null;
        this._lastDistanceBetweenLeftClickEvents = 0.0;
        this._lastDistanceBetweenRightClickEvents = 0.0;
        this._lastDistanceBetweenTouchPoints = 0.0;
        this._lastAngleBetweenTouchPoints = 0.0;

        if (mainAppElement.style) {
            mainAppElement.style.touchAction = "none";
        }

        if (window.PointerEvent) {
            mainAppElement.addEventListener('pointerdown', this._handleEvent.bind(this), false);
            mainAppElement.addEventListener('pointermove', this._handleEvent.bind(this), false);
            mainAppElement.addEventListener('pointerup', this._handleEvent.bind(this), false);
            mainAppElement.addEventListener("pointerout", this._handleEvent.bind(this), false);
        } else {
            mainAppElement.addEventListener('touchstart', this._handleEvent.bind(this), false);
            mainAppElement.addEventListener('touchmove', this._handleEvent.bind(this), false);
            mainAppElement.addEventListener('touchend', this._handleEvent.bind(this), false);
            mainAppElement.addEventListener("touchcancel", this._handleEvent.bind(this), false);
            mainAppElement.addEventListener("mousedown", this._handleEvent.bind(this), false);
        }
        mainAppElement.addEventListener("mousewheel", this._handleEvent.bind(this), false);
        mainAppElement.addEventListener("gesturestart", (e: any) => { e.preventDefault(); }, false);
        mainAppElement.addEventListener("gesturechange", (e: any) => { e.preventDefault(); }, false);
        mainAppElement.addEventListener("gestureend", (e: any) => { e.preventDefault(); }, false);
        mainAppElement.addEventListener("contextmenu", (e: any) => { e.preventDefault(); }, false);

        this.onCanvasDown = (e: any) => { };
        this.onCanvasMove = (e: any, base: any, delta: any) => { };
        this.onLeftDrag = (e: any, base: any, delta: any) => { };
        this.onRightDrag = (e: any, base: any, delta: any) => { };
        this.onPinch = (e: any, base: any, delta: any) => { };
        this.onRotate = (e: any, base: any, delta: any) => { };
        this.onClick = (e: any) => { };
        this.onWheel = (e: any) => { };
        // END Mouse Event Code

        // START Keyboard Event Code
        this._keyboardEventCache = [];
        mainAppElement.addEventListener('keydown', (e: any) => { this._onUserKeyDown(e); }, false);
        mainAppElement.addEventListener('keyup', (e: any) => { this._onUserKeyUp(e); }, false);
        
        this.onTurnLeftKeyDown = () => { };
        this.onTurnRightKeyDown = () => { };
        this.onMoveForwardKeyDown = () => { };
        this.onMoveBackwardKeyDown = () => { };
        this.onStrafeLeftKeyDown = () => { };
        this.onStrafeRightKeyDown = () => { };

        this.onTurnLeftKeyUp = () => { };
        this.onTurnRightKeyUp = () => { };
        this.onMoveForwardKeyUp = () => { };
        this.onMoveBackwardKeyUp = () => { };
        this.onStrafeLeftKeyUp = () => { };
        this.onStrafeRightKeyUp = () => { };
        // END Keyboard Event Code
    }

    private _handleEvent(event: any) {
        switch (event.type) {
            case "pointerdown":
            case "touchstart":
            case "mousedown":
                this._handleGestureOnCanvasStart(event);
                break;
            case "pointermove":
            case "touchmove":
            case "mousemove":
                this._handleGestureOnCanvasMove(event);
                break;
            case "pointerup":
            case "touchend":
            case "mouseup":
                this._handleGestureOnCanvasEnd(event);
                break;
            case "pointerout":
            case "touchcancel":
                this._handleGestureOnCanvasCancel(event);
                break;
            case "mousewheel":
                this._handleMouseWheel(event);
                break;
            default:
                break;
        }
    }

    private _pushEvent(event: any) {
        this._mouseEventCache.push(event);
    }

    private _removeEvent(event: any) {
        for (let i = 0; i < this._mouseEventCache.length; i++) {
            if (this._mouseEventCache[i].pointerId === event.pointerId) {
                this._mouseEventCache.splice(i, 1);
                i--;
                break;
            }
        }
    }

    private _getEventFromCacheByID(idToFind: any) {
        for (let i = 0; i < this._mouseEventCache.length; i++) {
            let id = this._mouseEventCache[i].pointerId;

            if (id == idToFind) {
                return this._mouseEventCache[i];
            }
        }
        return null;
    }

    private _getGesturePointFromEvent(evt: any) {
        let point = {
            x: 0,
            y: 0
        };

        if (evt.targetTouches) {
            // Prefer Touch Events
            point.x = evt.targetTouches[0].clientX;
            point.y = evt.targetTouches[0].clientY;
        } else {
            // Either Mouse event or Pointer Event
            point.x = evt.clientX;
            point.y = evt.clientY;
        }

        return point;
    }

    private _handleGestureOnCanvasStart(event: any) {
        event.preventDefault();
        event.target.focus();

        if (event.pointerId) {
            this._pushEvent(event);
        } else if (event.changedTouches) {
            let touches = event.changedTouches;
            for (let i = 0; i < touches.length; i++) {
                let currentEvent = touches[i];
                event = {
                    "pointerId": currentEvent.identifier,
                    "clientX": currentEvent.clientX,
                    "clientY": currentEvent.clientY,
                    "button": 0,
                    "buttons": 0
                };
                this._pushEvent(event);
            }
        }

        if (event.touches && event.touches.length > 1) {
            return;
        }

        if (window.PointerEvent) {
            event.target.setPointerCapture(event.pointerId);
        } else {
            document.addEventListener('mousemove', this._handleEvent.bind(this), false);
            document.addEventListener('mouseup', this._handleEvent.bind(this), false);
        }

        let gesturePoint = this._getGesturePointFromEvent(event);

        if (event.button === 0) {
            this._leftClickStartPositionPX = gesturePoint;
        }
        if (event.button === 2) {
            this._rightClickStartPositionPX = gesturePoint;
        } else if (this._mouseEventCache.length <= 1) {
            this._lastLeftDragPosition = gesturePoint;
        } else if (this._mouseEventCache.length > 1) {
            this._lastLeftDragPosition = null;
        }
        this.onCanvasDown(event);
    }

    private _handleGestureOnCanvasMove(event: any) {
        event.preventDefault();

        let gesturePoint = this._getGesturePointFromEvent(event);

        if (this._mouseEventCache.length < 1) {
            this.onCanvasMove(event);
        }

        if (event.buttons !== 2 && this._mouseEventCache.length <= 1 && !this._leftClickStartPositionPX && !this._rightClickStartPositionPX) {
            return;
        } else if (event.buttons !== 2 && this._lastLeftDragPosition && this._mouseEventCache.length <= 1) {
            let deltaPosition = {
                x: this._lastLeftDragPosition.x - gesturePoint.x,
                y: this._lastLeftDragPosition.y - gesturePoint.y
            };
            this._lastLeftDragPosition = gesturePoint;

            this.onLeftDrag(event, {
                base: this._lastDistanceBetweenLeftClickEvents,
                delta: deltaPosition
            });

        } else if (event.buttons === 2 && this._rightClickStartPositionPX && this._mouseEventCache.length <= 1) {
            let newDistance = gesturePoint.x - this._rightClickStartPositionPX.x;
            let deltaDistance = newDistance - this._lastDistanceBetweenRightClickEvents;
            this._lastDistanceBetweenRightClickEvents = newDistance;

            this.onRightDrag(event, {
                base: this._lastDistanceBetweenRightClickEvents,
                delta: deltaDistance
            });

        } else if (this._mouseEventCache.length === 2) {
            this._lastLeftDragPosition = null;
            let deltaX = this._mouseEventCache[0].clientX - this._mouseEventCache[1].clientX;
            let deltaY = this._mouseEventCache[0].clientY - this._mouseEventCache[1].clientY;
            this._lastDistanceBetweenTouchPoints = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
            this._lastAngleBetweenTouchPoints = Math.atan2(this._mouseEventCache[1].clientY - this._mouseEventCache[0].clientY, this._mouseEventCache[1].clientX - this._mouseEventCache[0].clientX);
            if (event.pointerId) {
                for (let i = 0; i < this._mouseEventCache.length; i++) {
                    if (this._mouseEventCache[i].pointerId === event.pointerId) {
                        this._mouseEventCache[i] = event;
                    }
                }
            } else if (event.changedTouches) {
                let touches = event.changedTouches;
                for (let i = 0; i < touches.length; i++) {
                    let currentEvent = this._getEventFromCacheByID(touches[i].identifier);
                    if (currentEvent) {
                        currentEvent.clientX = touches[i].clientX;
                        currentEvent.clientY = touches[i].clientY;
                    }
                }
            }
            deltaX = this._mouseEventCache[0].clientX - this._mouseEventCache[1].clientX;
            deltaY = this._mouseEventCache[0].clientY - this._mouseEventCache[1].clientY;
            let newDistance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
            let newAngle = Math.atan2(this._mouseEventCache[1].clientY - this._mouseEventCache[0].clientY, this._mouseEventCache[1].clientX - this._mouseEventCache[0].clientX);

            let deltaDistance = newDistance - this._lastDistanceBetweenTouchPoints;
            this.onPinch(event, {
                base: this._lastDistanceBetweenTouchPoints,
                delta: deltaDistance
            });

            let deltaAngle = newAngle - this._lastAngleBetweenTouchPoints;
            this.onRotate(event, {
                base: this._lastAngleBetweenTouchPoints,
                delta: deltaAngle
            });
        }
    }

    private _handleGestureOnCanvasEnd(event: any) {
        event.preventDefault();

        if (event.pointerId) {
            this._removeEvent(event);
        } else if (event.changedTouches) {
            let touches = event.changedTouches;
            for (let i = touches.length - 1; i >= 0; i--) {
                let currentEvent = this._getEventFromCacheByID(touches[i].identifier);
                if (currentEvent) {
                    this._removeEvent(currentEvent);
                }
            }
        }

        if ((event.touches && event.touches.length > 0) || this._mouseEventCache.length > 0) {
            return;
        }

        // Remove Event Listeners
        if (window.PointerEvent) {
            if (event.pointerId) {
                event.target.releasePointerCapture(event.pointerId);
            }
        } else {
            // Remove Mouse Listeners
            document.removeEventListener('mousemove', this._handleEvent.bind(this), false);
            document.removeEventListener('mouseup', this._handleEvent.bind(this), false);
        }

        if (this._lastLeftDragPosition && event.button !== 2) {
            this._lastLeftDragPosition = null;
            this._lastDistanceBetweenLeftClickEvents = 0;
        } else if (event.button === 2 && this._rightClickStartPositionPX) {
            this._rightClickStartPositionPX = null;
            this._lastDistanceBetweenRightClickEvents = 0;
        }
        if (event.button === 0) {
            this.onClick(event);
            this._leftClickStartPositionPX = null;
        }
    }

    private _handleGestureOnCanvasCancel(event: any) {
        this._handleGestureOnCanvasEnd(event);
    }

    private _handleMouseWheel(event: any) {
        if (event.deltaY != 0) {
            let wheelDir = event.deltaY / Math.abs(event.deltaY);
            this.onWheel(event, { base: event.deltaY, delta: wheelDir });
        }
    }

    private _onUserKeyDown(event: any) {
        let shouldAddKeyEvent = true;
        for (let i = 0; i < this._keyboardEventCache.length; i++) {
            if (this._keyboardEventCache[i].code === event.code) {
                shouldAddKeyEvent = false;
                break;
            }
        }
        if (shouldAddKeyEvent) {
            this._keyboardEventCache.unshift(event);
        }
        
        switch (this._keyboardEventCache[0].code) {
            case LEFT_ARROW_KEY_CODE:
            case A_KEY_CODE:
                this.onTurnLeftKeyDown();
                break;
            case RIGHT_ARROW_KEY_CODE:
            case D_KEY_CODE:
                this.onTurnRightKeyDown();
                break;
            case UP_ARROW_KEY_CODE:
            case W_KEY_CODE:
                this.onMoveForwardKeyDown();
                break;
            case DOWN_ARROW_KEY_CODE:
            case S_KEY_CODE:
                this.onMoveBackwardKeyDown();
                break;
            case Q_KEY_CODE:
                this.onStrafeLeftKeyDown();
                break;
            case E_KEY_CODE:
                this.onStrafeRightKeyDown();
                break;
        }
    }

    private _onUserKeyUp(event: any) {
        for (let i = this._keyboardEventCache.length - 1; i >= 0; i--) {
            if (this._keyboardEventCache[i].code === event.code) {
                this._keyboardEventCache.splice(i, 1);
            }
        }
    
        switch (event.code) {
            case LEFT_ARROW_KEY_CODE:
            case A_KEY_CODE:
                this.onTurnLeftKeyUp();
                break;
            case RIGHT_ARROW_KEY_CODE:
            case D_KEY_CODE:
                this.onTurnRightKeyUp();
                break;
            case UP_ARROW_KEY_CODE:
            case W_KEY_CODE:
                this.onMoveForwardKeyUp();
                break;
            case DOWN_ARROW_KEY_CODE:
            case S_KEY_CODE:
                this.onMoveBackwardKeyUp();
                break;
            case Q_KEY_CODE:
                this.onStrafeLeftKeyUp();
                break;
            case E_KEY_CODE:
                this.onStrafeRightKeyUp();
                break;
        }
    
        if (this._keyboardEventCache.length > 0) {
            this._onUserKeyDown(this._keyboardEventCache[0]);
        }
    }
}

exports.HiFiControls = HiFiControls;