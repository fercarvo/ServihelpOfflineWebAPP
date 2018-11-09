class EventBusClass {
	constructor() {
		this.listeners = new Map() //For a better performance instead object {}
	}

	addEventListener(type, callback, scope, ...args) {
		var arr_listener = this.listeners.get(type); //[...Array]

		if (!arr_listener)
			return this.listeners.set(type, [{scope, callback, args}] );

		arr_listener = [...arr_listener, {scope, callback, args}];
		this.listeners.set(type, arr_listener)
	}

	removeEventListener (type, callback, scope) {
		var arr_listener = this.listeners.get(type);

		if (!arr_listener) return;

		var new_arr = arr_listener.filter(listener => {
			return (listener.scope !== scope || listener.callback !== callback);
		})

		this.listeners.set(type, new_arr)
	}

	hasEventListener (type, callback, scope) {
		var arr_listener = this.listeners.get(type);

		if (!arr_listener)
			return false;

		if (!callback && !scope)
			return arr_listener.length > 0;

		return arr_listener.some(listener => {
			return (scope ? listener.scope === scope : true) && listener.callback === callback
		})
	}

	dispatch (type, target, ...args) {
		var arr_listener = this.listeners.get(type); //[...Array]
		var event = { type, target };

		if (!arr_listener)
			return;

		arr_listener.forEach(listener => {
			if (listener && listener.callback)
				listener.callback.apply(listener.scope, [event, ...args, ...listener.args] );
		})
	}

	get getEvents() {
		var str = ``;
		this.listeners.forEach((arr_listener, type)=> { //Map foeEach is (value, key)
			arr_listener.forEach(listener => {
				if (listener.scope) {
					if (listener.scope.className)
						str += listener.scope.className;
					else if (listener.scope.name)
						str += listener.scope.name;
					else
						str += `anonymous`;
				}
				str += ` listen for ${type} \n`;
			})
		})
		return str;
	}
}

const EventBus = new EventBusClass()