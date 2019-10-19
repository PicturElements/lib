export default class Undoable {
	constructor(type){
		this.type=type;
		this.store={};
	}

	do(){
		console.error("This Undoable doesn't implement a do method.");
		return this;
	}

	undo(){
		console.error("This Undoable doesn't implement an undo method.");
		return this;
	}
}

// Pain free WET for now
class UndoableArray extends Array {
	constructor(type){
		super();
		this.type=type;
		this.store={};
	}

	do(){
		console.error("This Undoable doesn't implement a do method.");
		return this;
	}

	undo(){
		console.error("This Undoable doesn't implement an undo method.");
		return this;
	}
}

Undoable.wrap=store=>{
	return new UndoableWrapper().set(store);
};

Undoable.pass=(type,...args)=>{
	return undoableFactory(type,null,null,args);
};

Undoable.as=(type,doFunc,undoFunc)=>{
	return undoableFactory(type,doFunc,undoFunc);
};

Undoable.new=(doFunc,undoFunc)=>{
	return undoableFactory(null,doFunc,undoFunc);
};

class UndoableEventListener extends Undoable {
	constructor(){
		super("event");
	}

	do(elem,type,callback,options){
		elem.addEventListener(type,callback,options);

		this.store={
			elem,
			type,
			callback,
			options
		};

		return this;
	}

	undo(){
		const s=this.store;
		s.elem.removeEventListener(s.type,s.callback,s.options);
		return this;
	}
}

class UndoableToggle extends Undoable {
	constructor(){
		super("toggle");
	}

	do(target,key){
		if (target==null)
			throw new TypeError("Invalid toggle target: target must be an object or a function");

		this.store={
			target,
			key
		};

		this.toggle();
	}

	undo(){
		this.toggle();
	}

	toggle(){
		const target=this.store.target,
			key=this.store.key;

		if (typeof target.toggle=="function")
			target.toggle.call(target,key);
		else if (typeof target=="function")
			target.call(target,key);
		else{
			if (target.hasOwnProperty(key))
				delete target[key];
			else
				target[key]=key;
		}
	}
}

class UndoableQueue extends UndoableArray {
	constructor(){
		super("queue");

		// Manually insert items so they're all guaranteed to
		// be Undoable instances.
		for (let i=0,l=arguments.length;i<l;i++)
			this.push(arguments[i]);
	}

	push(item){
		if (item instanceof Undoable)
			super.push(item);
		
		return this;
	}

	undo(idx){
		if (idx instanceof Undoable)
			idx=this.indexOf(idx);

		if (this.hasOwnProperty(idx)){
			const undoable=this.splice(idx,1)[0];
			undoable.undo.apply(undoable,[].slice.call(arguments,1));
		}
		
		return this;
	}

	undoAll(){
		this.forEach(u=>u.undo());
		this.splice(0,this.length);
		
		return this;
	}

	forEach(callback){
		if (typeof callback!="function")
			return this;

		for (let i=0;i<this.length;i++)
			callback(this[i],i,this);

		return this;
	}
}

class UndoableDict extends Undoable {
	constructor(dict){
		super("dict");
		this.dict={};

		if (!dict)
			return;

		this.setMulti(dict);
	}

	set(key,val){
		if (key&&val instanceof Undoable){
			// Undo previous Undoable if it exists in the dict
			this.undo(key);
			this.dict[key]=val;
		}

		return this;
	}

	get(key){
		return this.dict.hasOwnProperty(key)?this.dict[key]:null;
	}

	setMulti(dict){
		if (!dict)
			return;

		for (let k in dict)
			this.set(k,dict[k]);

		return this;
	}

	undo(key){
		if (this.dict.hasOwnProperty(key)){
			const undoable=this.dict[key];
			undoable.undo.apply(undoable,[].slice.call(arguments,1));

			delete this.dict[key];
		}

		return this;
	}

	undoAll(){
		for (let k in this.dict){
			if (this.dict.hasOwnProperty(k))
				this.undo(k);
		}

		this.dict={};
		return this;
	}

	forEach(callback){
		if (typeof callback!="function")
			return this;

		for (let k in this.dict){
			if (this.dict.hasOwnProperty(k))
				callback(this.dict[k],k,this);
		}

		return this;
	}
}

class UndoableWrapper extends Undoable {
	constructor(){
		super("wrapper");
		this.store=null;
	}

	set(store){
		if (store instanceof Array)
			this.store=new UndoableQueue(...store);
		else if (store&&store.constructor==Object)
			this.store=new UndoableDict(store);

		return this;
	}

	undo(){
		if (this.store)
			this.store.undoAll();
		
		return this;
	}

	forEach(callback){
		if (typeof callback!="function"||!this.store)
			return this;

		this.store.forEach(callback);
		return this;
	}
}

const types={
	event: UndoableEventListener,
	toggle: UndoableToggle,
	wrapper: UndoableWrapper,
	queue: UndoableQueue,
	dict: UndoableDict
};

function undoableFactory(type,doFunc,undoFunc,args){
	args=args || [];
	const constr=types[type];

	if (constr)
		return new constr(...args);
	else{
		if (typeof undoFunc!="function"){
			if (typeof doFunc=="function"){
				undoFunc=doFunc;
				doFunc=null;
			}else
				return console.warn("Cannot construct custom Undoable");
		}

		const undoable=new Undoable("generic");
		if (doFunc)
			undoable.do=wrapFunc(doFunc);
		undoable.undo=wrapFunc(undoFunc);

		return undoable;
	}
}

function wrapFunc(func){
	return function(){
		const retVal=func();
		return retVal===undefined?this:retVal;
	};
}

export {
	UndoableEventListener,
	UndoableToggle,
	UndoableQueue,
	UndoableDict,
	UndoableWrapper,
	undoableFactory
};
