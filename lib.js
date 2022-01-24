"use strict";

let SerialPort = require("serialport"),
    util       = require("util"),
    events     = require('events');

let Readline =  require('@serialport/parser-readline');

function Moon() {
    this.seq = 0;
}

util.inherits(Moon, events.EventEmitter);

let _processw = function() {
    if (!this._port) return;
    if (this._woutstanding) return;
    if (this._qw.length == 0) return;

    this._woutstanding = true;
    console.log("[Moon] writing:", this._qw[0]);

    this._port.write(this._qw[0] + "\n",
                    (err) => {
                        if (err) return;
                        this._qw.shift();
                        this._woutstanding = false;
                        setTimeout(() => { _processw.call(this); }, 150);
                    });
}

function send(val, cb) {
    this._qw.push(val);
    _processw.call(this);
};

// Increase master volume
Moon.prototype.volume_up = function() {
        send.call(this, "#046401\r");
};

// Decrease master volume
Moon.prototype.volume_down = function() {
       send.call(this, "#046402\r");
};

// Stop increase or decrease master volume
Moon.prototype.volume_stop = function() {
    send.call(this, "#046403\r");
};

Moon.prototype.power_off = function() {
        send.call(this, "#046003\r");
	    let val = "standby";
	    if (this.properties.source != val) { this.properties.source = val; this.emit('source', val); }
};

Moon.prototype.power_on = function() {
        send.call(this, "#046002\r");
        let val = "selected";
	    if (this.properties.source != val) { this.properties.source = val; this.emit('source', val); }
};

// This command sets the speaker output state.
Moon.prototype.set_speaker = function(val) {
    if (val == "on") { // Set speaker ON.
        send.call(this, "#046602\r");
    }
    else if (val == "off") { // Set speaker OFF.
        send.call(this, "#046603\r");
    }   
};

Moon.prototype.set_source = function(val) {
        send.call(this, "#0463" + val + "\r");
};
Moon.prototype.mute = function(val) {
    if (val != null){
        send.call(this, "#04650" + val + "\r");
    }
    else {
        send.call(this, "#046501\r");
    }       
};

Moon.prototype.init = function(opts, closecb) {
    let self = this;

    this._qw = [];
    this._woutstanding = false;

    this.properties = { volume: opts.volume || 1, source: opts.source || '8', usbVid: opts.usbVid };

    this.initializing = true;

        this._port = new SerialPort(opts.port, {
            baudRate: opts.baud || 9600
        });
        this.parser = this._port.pipe(new Readline({ delimiter: '\r' }));


        var data = { };
        this.parser.on('data', data => {
	    if (this.initializing) {
		    this.initializing = false;
		    this.emit('connected');
            }

	    console.log("[Moon] received: " + data);

	    if (/^#08A3..00..$/.test(data)) { // Pream Amp is Standby
	        let val = "standby";
	        if (this.properties.source != val) { this.properties.source = val; this.emit('source', val); }

        } else if (/^#08A3..08..$/.test(data)) { // Pream Amp is Standby and Speaker Off
	        let val = "standby";
	        if (this.properties.source != val) { this.properties.source = val; this.emit('source', val); }

        } else if (/^#08A3..01..$/.test(data)) { // Pream Amp is On
	        let val = "selected";
	        if (this.properties.source != val) { this.properties.source = val; this.emit('source', val); }

        } else if (/^#08A3..09..$/.test(data)) { // Pream Amp is On and Speaker Off
	        let val = "selected";
	        if (this.properties.source != val) { this.properties.source = val; this.emit('source', val); }

	    } else if (/^#08A3..03..$/.test(data)) { // Mute or Muted
	        let val = "Muted";
	        if (this.properties.source != val) { this.properties.source = val; this.emit('source', val); }

	    } 
		  else {
			console.log('No matching string');
		  }
        });

    
    let timer = setTimeout(() => {
	if (this.initializing) {
            this.initializing = false;
	    this.emit('connected');
	}
    }, 3000);
    this._port.on('open', err => {
        this.emit('preconnected');
        //Send status request to Pream Amp
        send.call(this, "#0201\r");
    });

    this._port.on('close',      ()  => { this._port.close(() => { this._port = undefined; if (closecb) { var cb2 = closecb; closecb = undefined; cb2('close');      } }) });
    this._port.on('error',      err => { this._port.close(() => { this._port = undefined; if (closecb) { var cb2 = closecb; closecb = undefined; cb2('error');      } }) });
    this._port.on('disconnect', ()  => { this._port.close(() => { this._port = undefined; if (closecb) { var cb2 = closecb; closecb = undefined; cb2('disconnect'); } }) });
};

Moon.prototype.start = function(opts) {
    this.seq++;

    let closecb = (why) => {
        this.emit('disconnected');
        if (why != 'close') {
            var seq = ++this.seq;
            setTimeout(() => {
                if (seq != this.seq) return;
                this.start(opts);
            }, 1000);
        }
    };

    if (this._port) {
        this._port.close(() => {
            this.init(opts, closecb);
        });
    } else {
        this.init(opts, closecb);
    }
};

Moon.prototype.stop = function() {
    this.seq++;

    if (this._port)
        this._port.close(() => {});
};

exports = module.exports = Moon;

