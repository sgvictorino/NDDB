/**
 * # NDDB: N-Dimensional Database
 * 
 * MIT Licensed
 * 
 * NDDB provides a simple, lightweight, NO-SQL object database 
 * for node.js and the browser.
 *
 * See README.md for help.
 * 
 * ---
 * 
 */

(function (exports, JSUS, store) {
	
	function QueryBuilder() {
		this.operations = {};
		this.registerDefaultOperations();
		this.reset();
	}
	
	QueryBuilder.prototype.addCondition = function(type, condition, comparator) {
		condition.type = type;
		condition.comparator = comparator;
		this.query[this.pointer].push(condition);
	};
	
	QueryBuilder.prototype.registerOperation = function(sign, cb) {
		this.operations[sign] = cb;
	};
	
	QueryBuilder.prototype.registerDefaultOperations = function() {
		
		this.operations['E'] = function (d, value, comparator) {
			return function(elem) {
				if ('undefined' !== typeof JSUS.getNestedValue(d,elem)) return elem;
			}
		};
    
		this.operations['=='] = function (d, value, comparator) {
			return function(elem) {
				if (comparator(elem, value) === 0) return elem;
			};
		};
		
		this.operations['>'] = function (d, value, comparator) {
			return function(elem) {
				var compared = comparator(elem, value);
				if (compared === 1 || compared === 0) return elem;
			};
		};
		
		this.operations['<'] = function (d, value, comparator) {
			return function(elem) {
				if (comparator(elem, value) === -1) return elem;
			};
		};
		
		this.operations['<='] = function (d, value, comparator) {
			return function(elem) {
				var compared = comparator(elem, value);
				if (compared === -1 || compared === 0) return elem;
			};
		};
	   
	    // Between
	    this.operations['><'] = function (d, value, comparator) {
	    	return function(elem) {
	    		if (comparator(elem, value[0]) > 0 && comparator(elem, value[1]) < 0) {
		            return elem;
		        }
	    	};
	    };
	    // Not Between
	    this.operations['<>'] = function (d, value, comparator) {
	    	return function(elem) {
		        if (comparator(elem, value[0]) < 0 && comparator(elem, value[1] > 0)) {
		            return elem;
		        }
	    	};
	    };
	    
	    // In Array
	    this.operations['in'] = function (d, value, comparator) {
	    	return function(elem) {
		        if (JSUS.in_array(JSUS.getNestedValue(d,elem), value)) {
		            return elem;
		        }
	    	};
	    };
	    
	    // Not In Array
	    this.operations['!in'] = function (d, value, comparator) {
	    	return function(elem) {
		        if (!JSUS.in_array(JSUS.getNestedValue(d,elem), value)) {
		            return elem;
		        }
	    	};
	    };
	};
	
	function findCallback(obj, operations) {

		var d = obj.d,
			op = obj.op,
			value = obj.value,
			comparator = obj.comparator;
		
		return operations[op](d, value, comparator);  
	};	
	
	QueryBuilder.prototype.addBreak = function() {
		this.pointer++;
		this.query[this.pointer] = [];
	};

	QueryBuilder.prototype.reset = function() {
		this.query = [];
		this.pointer = 0;
		this.query[this.pointer] = [];
	};

	QueryBuilder.prototype.get = function() {
		var line, lineLen, f1, f2, f3, type1, type2, i;
		var query = this.query, pointer = this.pointer;
		var operations = this.operations;
		
		if (pointer === 0) {
			line = query[pointer]
			lineLen = line.length; 
			
			if (lineLen === 1) {
				return findCallback(line[0], operations);
			}
			
			else if (lineLen === 2) {
				f1 = findCallback(line[0], operations);
				f2 = findCallback(line[1], operations);
				type1 = line[1].type;
				
				switch (type1) {
					case 'OR': 
						return function(elem) {
							if ('undefined' !== typeof f1(elem)) return elem;
							if ('undefined' !== typeof f2(elem)) return elem;
						}	
					case 'AND':
						return function(elem) {
							if ('undefined' !== typeof f1(elem) && 'undefined' !== typeof f2(elem)) return elem;
						}
					
					case 'NOT':
						return function(elem) {
							if ('undefined' !== typeof f1(elem) && 'undefined' === typeof f2(elem)) return elem;
						}
				}
			}
			
			else if (lineLen === 3) {
				f1 = findCallback(line[0], operations);
				f2 = findCallback(line[1], operations);
				f3 = findCallback(line[2], operations);
				type1 = line[1].type;
				type2 = line[2].type;
				type1 = type1 + '_' + type2;
				switch (type1) {
					case 'OR_OR': 
						return function(elem) {
							if ('undefined' !== typeof f1(elem)) return elem;
							if ('undefined' !== typeof f2(elem)) return elem;
							if ('undefined' !== typeof f3(elem)) return elem;
						};	
						
					case 'OR_AND':
						return function(elem) {
						
							if ('undefined' === typeof f3(elem)) return;
							if ('undefined' !== typeof f2(elem)) return elem;
							if ('undefined' !== typeof f1(elem)) return elem;
						};
					
					case 'AND_OR':
						return function(elem) {
							if ('undefined' !== typeof f3(elem)) return elem;
							if ('undefined' === typeof f2(elem)) return;
							if ('undefined' !== typeof f1(elem)) return elem;
						};
						
					case 'AND_AND':
						return function(elem) {
							if ('undefined' === typeof f3(elem)) return;
							if ('undefined' === typeof f2(elem)) return;
							if ('undefined' !== typeof f1(elem)) return elem;
						};
				}
			}
			
			else {				
				return function(elem) {
					var i, f, type, resOK;
					var prevType = 'OR', prevResOK = true;
					for (i = lineLen-1 ; i > -1 ; i--) {
						
				
						f = findCallback(line[i], operations);
						type = line[i].type,
						resOK = 'undefined' !== typeof f(elem);
						
						if (type === 'OR') {
							// Current condition is TRUE OR
							if (resOK) return elem;
						}
						
						// Current condition is FALSE AND 
						else if (type === 'AND') {
							if (!resOK) {
								return;
							}
							// Previous check was an AND or a FALSE OR
							else if (prevType === 'OR' && !prevResOK) {
								return;
							}
						}
						prevType = type;
						// A previous OR is TRUE also if follows a TRUE AND 
						prevResOK = type === 'AND' ? resOK : resOK || prevResOK;
						
					}
					return elem;
				}
				
			}
			
		}
		
		else if (pointer === 1) {
			
		}
		
	};

NDDB.compatibility = JSUS.compatibility();
	
// Expose constructors
exports.NDDB = NDDB;

// ### NDDB.log
// Stdout redirect
NDDB.log = console.log;


/**
 * ### NDDB.retrocycle
 * 
 * Removes cyclic references from an object
 * 
 * @param {object} e The object to decycle
 * @return {object} e The decycled object
 * 
 * 	@see https://github.com/douglascrockford/JSON-js/
 */
NDDB.decycle = function(e) {
	if (JSON && JSON.decycle && 'function' === typeof JSON.decycle) {
		e = JSON.decycle(e);
	}
	return e;
};

/**
 * ### NDDB.retrocycle
 * 
 * Restores cyclic references in an object previously decycled
 * 
 * @param {object} e The object to retrocycle
 * @return {object} e The retrocycled object
 * 
 * 	@see https://github.com/douglascrockford/JSON-js/
 */
NDDB.retrocycle = function(e) {
	if (JSON && JSON.retrocycle && 'function' === typeof JSON.retrocycle) {
		e = JSON.retrocycle(e);
	}
	return e;
};


/**
 * ## NDDB constructor
 *
 * Creates a new instance of NDDB
 * 
 * @param {object} options Optional. Configuration options
 * @param {db} db Optional. An initial set of items to import
 * 
 */
function NDDB (options, db) {                
    options = options || {};
    
    if (!JSUS) throw new Error('JSUS not found.');
    
    // ## Public properties
    
    // ### db
    // The default database
    this.db = [];
    
    // ###tags
    // The tags list
    this.tags = {};
    
    // ### hooks
    // The list of hooks and associated callbacks
    this.hooks = {
		insert: [],
    	remove: []	
    };
    
    // ### nddb_pointer
    // Pointer for iterating along all the elements
    this.nddb_pointer = 0; 
    
    // ### length
    // The number of items in the database
    if (NDDB.compatibility.getter) {
    	this.__defineGetter__('length', function() { return this.db.length; });
    }
	else {
    	this.length = null;
    }
   
    // ### query
    // QueryBuilder obj
    this.query = new QueryBuilder();
    
    // ### __C
    // List of comparator functions
    this.__C = {};
    
    // ### __H
    // List of hashing functions
    this.__H = {};
    
    // ### __I
    // List of hashing functions
    this.__I = {};
    
    // ### __update
    // Auto update options container
    this.__update = {};
    
    // ### __update.pointer
    // If TRUE, nddb_pointer always points to the last insert
    this.__update.pointer 	= false;
    
    // ### __update.indexes
    // If TRUE, rebuild indexes on every insert and remove
    this.__update.indexes 	= false;
    
    // ### __update.sort
    // If TRUE, sort db on every insert and remove
    this.__update.sort 		= false;
    
    this.init(options);
    this.importDB(db);   
};

// ## METHODS

/**
 * ### NDDB.init
 * 
 * Sets global options based on local configuration
 * 
 * @param {object} options Optional. Configuration options
 * 
 */
NDDB.prototype.init = function(options) {
	options = options || {};
	
	this.__options = options;
	
	if (options.log) {
		NDDB.log = options.log;
	}
    
	if (options.C) {
		this.__C = options.C;
	}
	
	if (options.H) {
		this.__H = options.H;
	}
	
	if (options.I) {
		this.__I = options.I;
	}
	
	if (options.tags) {
		this.tags = options.tags;
	}
    
    if (options.nddb_pointer > 0) {
    	this.nddb_pointer = options.nddb_pointer;
	}
    
    if (options.hooks) {
    	this.hooks = options.hook;
    }
    
    if (options.update) {
        if ('undefined' !== typeof options.update.pointer) {
        	this.__update.pointer = options.update.pointer;
        }
           
        if ('undefined' !== typeof options.update.indexes) {
        	this.__update.indexes = options.update.indexes;
        }
                                        
        if ('undefined' !== typeof options.update.sort) {
        	this.__update.sort = options.update.sort;
        }
    }
};

// ## CORE

/**
 * ### NDDB.globalCompare
 * 
 * Function used for comparing two items in the database
 * 
 * By default, elements are sorted according to their 
 * internal id (FIFO). Override to change.
 * 
 * Returns
 * 
 *  - 0 if the objects are the same
 *  - a positive number if o2 precedes o1 
 *  - a negative number if o1 precedes o2 
 * 
 * @param {object} o1 The first object to compare
 * @param {object} o1 The second object to compare
 * @return {number} The result of the comparison
 * 
 */
NDDB.prototype.globalCompare = function(o1, o2) {
    if ('undefined' === typeof o1 && 'undefined' === typeof o2) return 0;
    if ('undefined' === typeof o2) return -1;  
    if ('undefined' === typeof o1) return 1;
    return 0;
};

/**
 * ### NDDB._masqueradeDB
 *
 * Masquerades a whole array and returns it
 * 
 * @see NDDB._masquerade
 * @api private
 * @param {array} db Array of items to masquerade
 * 
 */
NDDB.prototype._masqueradeDB = function (db) {
    if (!db) return [];
    var out = [];
    for (var i = 0; i < db.length; i++) {
        out[i] = this._masquerade(db[i], out);
    }
    return out;
};

/**
 * ### NDDB._autoUpdate
 *
 * Performs a series of automatic checkings 
 * and updates the db according to current 
 * configuration
 * 
 * @api private
 * @param {object} options Optional. Configuration object
 */
NDDB.prototype._autoUpdate = function (options) {
	var update = (options) ? JSUS.merge(options, this.__update)
						   : this.__update;
	
    if (update.pointer) {
        this.nddb_pointer = this.db.length-1;
    }
    if (update.sort) {
        this.sort();
    }
    
    if (update.indexes) {
        this.rebuildIndexes();
    }
}

/**
 * ### NDDB.importDB
 * 
 * Imports a whole array into the current database
 * 
 * @param {array} db Array of items to import
 */
NDDB.prototype.importDB = function (db) {
    if (!db) return;
    if (!this.db) this.db = [];
    for (var i = 0; i < db.length; i++) {
        this.insert(db[i]);
    }
    // <!-- Check this
    //this.db = this.db.concat(this._masqueradeDB(db));
    //this._autoUpdate();
    // -->
};
    
/**
 * ### NDDB.insert
 * 
 * Insert an item into the database
 * 
 * Item must be of type object or function. 
 * 
 * The following entries will be ignored:
 * 
 * 	- strings
 * 	- numbers
 * 	- undefined
 * 	- null
 * 
 * @param {object} o The item or array of items to insert
 * @see NDDB._insert
 */
NDDB.prototype.insert = function (o) {
	if (o === null) return;
	var type = typeof(o);
	if (type === 'undefined') return;
	if (type === 'string') return;
	if (type === 'number') return;
	
	if (!this.db) this.db = [];
 
	this.db.push(o);
    this.emit('insert', o);
    
	// We save time calling _hashIt only
    // on the latest inserted element
    if (this.__update.indexes) {
    	this._hashIt(o);
    	this._indexIt(o);
    }
	// See above
    this._autoUpdate({indexes: false});
};

/**
 * ### NDDB.breed
 *
 * Creates a clone of the current NDDB object
 * 
 * Takes care of calling the actual constructor
 * of the class, so that inheriting objects will
 * preserve their prototype.
 * 
 * @param {array} db Array of items to import in the new database
 * @return {NDDB} The new database 
 */
NDDB.prototype.breed = function (db) {
    db = db || this.db;
  			  
    //In case the class was inherited
    return new this.constructor(this.cloneSettings(), db);
};
    
/**
 * ### NDDB.cloneSettings
 *
 * Creates a configuration object to initialize
 * a new NDDB instance based on the current settings
 * and returns it
 * 
 * @return {object} options A copy of the current settings
 * 
 */
NDDB.prototype.cloneSettings = function () {
    var options = this.__options || {};
    
    options.H = 		this.__H;
    options.I = 		this.__I;
    options.C = 		this.__C;
    options.tags = 		this.tags;
    options.update = 	this.__update;
    
    return JSUS.clone(options);
};    

/**
 * ### NDDB.toString
 *
 * Returns a human-readable representation of the database
 * 
 * @return {string} out A human-readable representation of the database
 */
NDDB.prototype.toString = function () {
    var out = '';
    for (var i=0; i< this.db.length; i++) {
        out += this.db[i] + "\n";
    }    
    return out;
};    
    
/**
 * ### NDDB.stringify
 *
 * Returns a machine-readable representation of the database
 * 
 * Cyclic objects are decycled.
 * 
 * @param {boolean} TRUE, if compressed
 * @return {string} out A machine-readable representation of the database
 * 
 * @see JSUS.stringify
 */
NDDB.prototype.stringify = function (compressed) {
	if (!this.length) return '[]';
	compressed = ('undefined' === typeof compressed) ? true : compressed;
	
	var spaces = compressed ? 0 : 4;
	
    var out = '[';
    this.each(function(e) {
    	// decycle, if possible
    	e = NDDB.decycle(e);
    	out += JSUS.stringify(e) + ', ';
    });
    out = out.replace(/, $/,']');

    return out;
};    


/**
 * ### NDDB.compare | NDDB.c 
 *
 * Registers a comparator function for dimension d
 * 
 * Each time a comparison between two objects containing
 * property named as the specified dimension, the registered
 * comparator function will be used.
 * 
 * @param {string} d The name of the dimension
 * @param {function} comparator The comparator function
 * @return {boolean} TRUE, if registration was successful
 * 
 */
NDDB.prototype.compare = NDDB.prototype.c = function (d, comparator) {
    if (!d || !comparator) {
        NDDB.log('Cannot set empty property or empty comparator', 'ERR');
        return false;
    }
    this.__C[d] = comparator;
    return true;
};

/**
 * ### NDDB.comparator
 *
 * Retrieves the comparator function for dimension d.
 *  
 * If no comparator function is found, returns a generic
 * comparator function. 
 * 
 * @param {string} d The name of the dimension
 * @return {function} The comparator function
 * 
 * @see NDDB.compare
 */
NDDB.prototype.comparator = function (d) {
    if ('undefined' !== typeof this.__C[d]) {
    	return this.__C[d]; 
    }
    
    return function (o1, o2) {
// <!--    	
//            NDDB.log('1' + o1);
//            NDDB.log('2' + o2);
// -->    	
        if ('undefined' === typeof o1 && 'undefined' === typeof o2) return 0;
        if ('undefined' === typeof o1) return 1;
        if ('undefined' === typeof o2) return -1;        
        var v1 = JSUS.getNestedValue(d,o1);
        var v2 = JSUS.getNestedValue(d,o2);
// <!--
//            NDDB.log(v1);
//            NDDB.log(v2);
// -->        
        if ('undefined' === typeof v1 && 'undefined' === typeof v2) return 0;
        if ('undefined' === typeof v1) return 1;
        if ('undefined' === typeof v2) return -1;
        if (v1 > v2) return 1;
        if (v2 > v1) return -1;
        return 0;
    };    
};

/**
 * ### NDDB.isReservedWord
 *
 * Returns TRUE if a property or a method with the same name
 * already exists in the current instance od NDDB 
 * 
 * @param {string} key The name of the property
 * @return {boolean} TRUE, if the property exists
 */
NDDB.prototype.isReservedWord = function (key) {
	return (this[key]) ? true : false; 
};


/**
 * ### NDDB._isValidIndex
 *
 * Returns TRUE if the index is not a reserved word, otherwise
 * displays an error and returns FALSE. 
 * 
 * @param {string} key The name of the property
 * @return {boolean} TRUE, if the index has a valid name
 */
NDDB.prototype._isValidIndex = function (idx) {
	if ('undefined' === typeof idx) {
		NDDB.log('A valid index name must be provided', 'ERR');
		return false;
	}
	if (this.isReservedWord(idx)) {
		var str = 'A reserved word have been selected as an index. ';
		str += 'Please select another one: ' + idx;
		NDDB.log(str, 'ERR');
		return false;
	}
	return true;
};

/**
 * ### NDDB.hash | NDDB.h
 *
 * Registers a new hashing function
 * 
 * Hashing functions creates nested NDDB database 
 * where objects are automatically added 
 * 
 * If no function is specified Object.toString is used.
 * 
 * @param {string} idx The name of index
 * @param {function} func The hashing function
 * @return {boolean} TRUE, if registration was successful
 * 
 * @see NDDB.isReservedWord
 * @see NDDB.rebuildIndexes
 * 
 */
NDDB.prototype.hash = NDDB.prototype.h = function (idx, func) {
	if (!this._isValidIndex(idx)) return false;
	this.__H[idx] = func || Object.toString;
	this[idx] = {};
	return true;
};


/**
 * ### NDDB.index | NDDB.i
 *
 * Registers a new indexing function
 * 
 * Hashing functions automatically creates indexes 
 * to have direct access to objects
 * 
 * If no function is specified Object.toString is used.
 * 
 * @param {string} idx The name of index
 * @param {function} func The hashing function
 * @return {boolean} TRUE, if registration was successful
 * 
 * @see NDDB.isReservedWord
 * @see NDDB.rebuildIndexes
 * 
 */
NDDB.prototype.index = NDDB.prototype.i = function (idx, func) {
	if (!this._isValidIndex(idx)) return false;
	this.__I[idx] = func || Object.toString;
	this[idx] = {};
	return true;
};



/**
 * ### NDDB.rebuildIndexes
 *
 * Resets and rebuilds all the database indexes 
 * 
 * Indexes are defined by the hashing functions
 * 
 * @see NDDB.hash
 */
NDDB.prototype.rebuildIndexes = function() {
	var h = false, i = false;
	
	if (!JSUS.isEmpty(this.__H)) {
		h = true;
		// Reset current hash-indexes
		for (var key in this.__H) {
			if (this.__H.hasOwnProperty(key)) {
				this[key] = {};
			}
		}
	}
	
	if (!JSUS.isEmpty(this.__I)) {
		i = true;
		// Reset current hash-indexes
		for (var key in this.__I) {
			if (this.__I.hasOwnProperty(key)) {
				this[key] = {};
			}
		}
	}
	
	if (h && !i) {
		this.each(this._hashIt);
	}
	else if (!h && i) {
		this.each(this._indexIt);
	}
	else if (h && i) {
		this.each(function(o){
			this.hashIt(o);
			this.indexIt(o);
		});
	}
	
};

/**
 * ### NDDB._hashIt
 *
 * Hashes an element
 * 
 * @param {object} o The element to hash
 * @return {boolean} TRUE, if insertion to an index was successful
 * 
 */
NDDB.prototype._hashIt = function(o) {
  	if (!o) return false;
	if (JSUS.isEmpty(this.__H)) {
		return false;
	}

	var h = null,
		id = null,
		hash = null;
	
	for (var key in this.__H) {
		if (this.__H.hasOwnProperty(key)) {
			h = this.__H[key];	    			
			hash = h(o);

			if ('undefined' === typeof hash) {
				continue;
			}

			if (!this[key]) {
				this[key] = {};
			}
			
			if (!this[key][hash]) {
				this[key][hash] = new NDDB();
			}
			this[key][hash].insert(o);		
		}
	}
};

/**
 * ### NDDB._hashIt
 *
 * Indexes an element
 * 
 * @param {object} o The element to index
 * @return {boolean} TRUE, if insertion to an index was successful
 * 
 */
NDDB.prototype._indexIt = function(o) {
  	if (!o) return false;
	if (JSUS.isEmpty(this.__I)) {
		return false;
	}
	
	var func = null,
		id = null,
		index = null;
	
	for (var key in this.__I) {
		if (this.__I.hasOwnProperty(key)) {
			func = this.__I[key];	    			
			index = func(o);

			if ('undefined' === typeof index) {
				continue;
			}
			if (!this[key]) this[key] = {};
			this[key][index] = o;
		}
	}
};

// ## Event emitter / listener

/**
 * ### NDDB.on
 * 
 * Registers an event listeners
 * 
 * Available events: 
 * 
 * 	`insert`: each time an item is inserted 
 * 	`remove`: each time a collection of items is removed
 * 
 * Examples.
 * 
 * ```javascript
 * var db = new NDDB();
 * 
 * var trashBin = new NDDB();
 * 
 * db.on('insert', function(item){
 * 		item.id = getMyNextId();	
 * });
 * 
 * db.on('remove', function(array) {
 * 		trashBin.importDB(array);
 * });
 * ```
 * 
 */
NDDB.prototype.on = function(event, func) {
	if (!event || !func || !this.hooks[event]) return;
    this.hooks[event].push(func);
    return true;
};

/**
 * ### NDDB.off
 * 
 * Deregister an event, or an event listener
 * 
 * @param {string} event The event name
 * @param {function} func Optional. The specific function to deregister 
 * 
 * @return Boolean TRUE, if the removal is successful
 */
NDDB.prototype.off = function(event, func) {
	if (!event || !this.hooks[event] || !this.hooks[event].length) return;
	 
    if (!func) {
    	this.hooks[event] = [];
    	return true;
    }
     
    for (var i=0; i < this.hooks[event].length; i++) {
    	if (this.hooks[event][i] == func) {
    		this.hooks[event].splice(i, 1);
	        return true;
	    }
	}
     
    return false;
}

/**
 * ### NDDB.emit
 * 
 * Fires all the listeners associated with an event
 * 
 * @param event {string} The event name 
 * @param {object} o Optional. A parameter to be passed to the listener
 * 
 */
NDDB.prototype.emit = function(event, o) {
	if (!event || !this.hooks[event] || !this.hooks[event].length) return;
	
	for (var i=0; i < this.hooks[event].length; i++) {
		this.hooks[event][i].call(this, o);
	}
};

// ## Sort and Select

/**
 * ### NDDB._analyzeQuery
 *
 * Validates and prepares select queries before execution
 * 
 * @api private
 * @param {string} d The dimension of comparison
 * @param {string} op The operation to perform
 * @param {string} value The right-hand element of comparison
 * @return {boolean|object} The object-query or FALSE if an error was detected 
 */
NDDB.prototype._analyzeQuery = function (d, op, value) {
    
    var raiseError = function (d,op,value) {
        var miss = '(?)';
        var err = 'Malformed query: ' + d || miss + ' ' + op || miss + ' ' + value || miss;
        NDDB.log(err, 'WARN');
        return false;
    };
    

    if ('undefined' === typeof d) raiseError(d,op,value);
    
    // Verify input 
    if ('undefined' !== typeof op) {
        if ('undefined' === typeof value) {
            raiseError(d,op,value);
        }
        
        if (op === '=') {
            op = '==';
        }
      
        if (!(op in this.query.operations)) {
            NDDB.log('Query error. Invalid operator detected: ' + op, 'WARN');
            return false;
        }
        

        
        // Range-queries need an array as third parameter
        if (JSUS.in_array(op,['><', '<>', 'in', '!in'])) {
            if (!(value instanceof Array)) {
                NDDB.log('Range-queries need an array as third parameter', 'WARN');
                raiseError(d,op,value);
            }
            if (op === '<>' || op === '><') {
                
                value[0] = JSUS.setNestedValue(d, value[0]);
                value[1] = JSUS.setNestedValue(d, value[1]);
            }
        }
        else {
            // Encapsulating the value;
            value = JSUS.setNestedValue(d,value);
        }
    }
    else if ('undefined' !== typeof value) {
        raiseError(d,op,value);
    }
    else {
        op = 'E'; // exists
        value = '';
    }
    
    return {d:d,op:op,value:value};
};

/**
 * ## NDDB.distinct
 * 
 * Eliminates duplicated entries
 *  
 * A new database is returned and the original stays unchanged
 * 
 * @return {NDDB} A copy of the current selection without duplicated entries
 * 
 * 	@see NDDB.select() 
 *  @see NDDB.fetch()
 *  @see NDDB.fetchValues()
 */
NDDB.prototype.distinct = function () {
	return this.breed(JSUS.distinct(this.db));
};

/**
 * ## NDDB.select
 * 
 * Select entries a subset of entries in the database 
 * 
 * Input parameters:
 * 
 * - d: the string representation of the dimension used to filter. Mandatory.
 * - op: operator for selection. Allowed: >, <, >=, <=, = (same as ==), ==, ===, 
 * 		!=, !==, in (in array), !in, >< (not in interval), <> (in interval)
 *  - value: values of comparison. Operators: in, !in, ><, <> require an array.
 *  
 *  The selection is returned as a new NDDB object, on which further operations 
 *  can be chained. In order to get the actual entries returned, it is necessary
 *  to call one of the fetching methods.
 *  
 * @param {string} d The dimension of comparison
 * @param {string} op The operation to perform
 * @param {string} value The right-hand element of comparison
 * @return {NDDB} A new NDDB instance containing the selected items
 * 
 *  @see NDDB.fetch()
 *  @see NDDB.fetchValues()
 */
NDDB.prototype.select = function (d, op, value) {
    this.query.reset();
    return arguments.length ? this.and(d, op, value) : this;
};


NDDB.prototype.and = function (d, op, value) {
	if (!arguments.length) {
		addBreakInQuery();
	}
	else {
		var condition = this._analyzeQuery(d, op, value);        
	    if (!condition) return false;
	    this.query.addCondition('AND', condition, this.comparator(d));
	}			
	return this;
};

NDDB.prototype.or = function (d, op, value) {
	if (!arguments.length) {
		addBreakInQuery();
	}
	else {
		var condition = this._analyzeQuery(d, op, value);        
	    if (!condition) return false;
	    this.query.addCondition('OR', condition, this.comparator(d));
	}			
	return this;
};

NDDB.prototype.execute = function () {
    return this.filter(this.query.get.call(this.query));
};

/**
 * ### NDDB.exists
 * 
 * Returns TRUE if a copy of the object exists in 
 * the database
 * 
 * @param {object} o The object to look for
 * @return {boolean} TRUE, if a copy is found
 * 
 * @see JSUS.equals
 */
NDDB.prototype.exists = function (o) {
	if (!o) return false;
	
	for (var i = 0 ; i < this.db.length ; i++) {
		if (JSUS.equals(this.db[i], o)) {
			return true;
		}
	}
	
    return false;
};

/**
 * ### NDDB.limit
 *
 * Creates a copy of the current database containing only 
 * the first N entries
 * 
 * If limit is a negative number, selection is made starting 
 * from the end of the database.
 * 
 * @param {number} limit The number of entries to include
 * @return {NDDB} A "limited" copy of the current instance of NDDB
 * 
 *	@see NDDB.first
 * 	@see NDDB.last
 */
NDDB.prototype.limit = function (limit) {
	limit = limit || 0;
    if (limit === 0) return this.breed();
    var db = (limit > 0) ? this.db.slice(0, limit) :
                           this.db.slice(limit);
    
    return this.breed(db);
};
    
/**
 * ### NDDB.reverse
 *
 * Reverses the order of all the entries in the database
 * 
 * 	@see NDDB.sort
 */
NDDB.prototype.reverse = function () {
    this.db.reverse();
    return this;
};
    
/**
 * ### NDDB.sort
 *
 * Sort the db according to one of the following
 * criteria:
 *  
 *  - globalCompare function, if no parameter is passed 
 *  - one of the dimension, if a string is passed
 *  - a custom comparator function 
 * 
 * A reference to the current NDDB object is returned, so that
 * further operations can be chained. 
 * 
 * Notice: the order of entries is changed.
 * 
 * @param {string|arrat|function} d Optional. The criterium of sorting
 * @return {NDDB} A sorted copy of the current instance of NDDB 
 */
  NDDB.prototype.sort = function (d) {
    // GLOBAL compare  
    if (!d) {
        var func = this.globalCompare;
    }
    
    // FUNCTION  
    else if ('function' === typeof d) {
      var func = d;
    }
    
    // ARRAY of dimensions
    else if (d instanceof Array) {
      var that = this;
      var func = function (a,b) {
        for (var i=0; i < d.length; i++) {
          var result = that.comparator(d[i]).call(that,a,b);
          if (result !== 0) return result;
        }
        return result;
      }
    }
    
    // SINGLE dimension
    else {
      var func = this.comparator(d);
    }
    
    this.db.sort(func);
    return this;
  };

/**
 * ### NDDB.shuffle
 *
 * Randomly shuffles all the entries of the database
 * 
 * Changes the order of elements in the current database
 * 
 * @return {NDDB} A a reference to the current instance with shuffled entries
 */
NDDB.prototype.shuffle = function () {
    // TODO: check do we need to reassign __nddbid__ ?
    this.db = JSUS.shuffle(this.db);
    return this;
};
    
// ## Custom callbacks
  
/**
 * ### NDDB.filter
 *
 * Filters the entries of the database according to the
 * specified callback function. 
 * 
 * A new NDDB instance is breeded.
 * 
 * @param {function} func The filtering function
 * @return {NDDB} A new instance of NDDB containing the filtered entries 
 * 
 * @see NDDB.breed
 * 
 */
NDDB.prototype.filter = function (func) {
    return this.breed(this.db.filter(func));
};


/**
 * ### NDDB.each || NDDB.forEach
 *
 * Applies a callback function to each element in the db.
 * 
 * It accepts a variable number of input arguments, but the first one 
 * must be a valid callback, and all the following are passed as parameters
 * to the callback
 * 
 * @see NDDB.map
 */
NDDB.prototype.each = NDDB.prototype.forEach = function () {
    if (arguments.length === 0) return;
    var func = arguments[0];    
    for (var i=0; i < this.db.length; i++) {
        arguments[0] = this.db[i];
        func.apply(this, arguments);
    }
};

/**
 * ### NDDB.map
 *
 * Applies a callback function to each element in the db, store
 * the results in an array and returns it.
 * 
 * It accepts a variable number of input arguments, but the first one 
 * must be a valid callback, and all the following are passed as parameters
 * to the callback
 * 
 * @return {array} out The result of the mapping
 * @see NDDB.each
 * 
 */
NDDB.prototype.map = function () {
    if (arguments.length === 0) return;
    var func = arguments[0];
    var out = [];
    var o = undefined;
    for (var i=0; i < this.db.length; i++) {
        arguments[0] = this.db[i];
        o = func.apply(this, arguments);
        if ('undefined' !== typeof o) out.push(o);
    }
    return out;
};

// # Update

///**
// * ### NDDB.remove
// *
// * Removes all entries from the database
// * 
// * Elements in the parent database will be removed too.
// * 
// * @return {NDDB} A new instance of NDDB with no entries 
// */
//
//NDDB.prototype.update = function (update) {
//	if (!this.length) {
//		NDDB.log('Cannot update empty database', 'WARN');
//		return this;
//	}
//  
//	if (!JSUS.isArray(update)) update = [update];
//	
//	    	  
//	for (var i=0; i < this.db.length; i++) {
//		this.db[i] = update[i % update.length];
//		
//		var idx = this.db[i].nddbid - i;
//		if (this.__parent) {
//		this.__parent.db.splice(idx,1);
//    }
//    // TODO: we could make it with only one for loop
//    // we loop on parent db and check whether the id is in the array
//    // at the same time we decrement the nddbid depending on i
//    for (var i=0; i < this.__parent.length; i++) {
//    	this.__parent.db[i].nddbid = i;
//    }
//	
// 
//	this.db = [];
//	this._autoUpdate();
//	return this;
//};  

//## Deletion


/**
 * ### NDDB.remove
 *
 * Removes all entries from the database
 * 
 * Elements in the parent database will be removed too.
 * 
 * @return {NDDB} A new instance of NDDB with no entries 
 */
NDDB.prototype.remove = function () {
	if (!this.length) return this;
	
	this.emit('remove', this.db);
	this.db = [];
	this._autoUpdate();
	return this;
};    

/**
 * ### NDDB.clear
 *
 * Removes all entries from the database. 
 * 
 * Requires an additional parameter to confirm the deletion.
 * 
 * @return {boolean} TRUE, if the database was cleared
 */
NDDB.prototype.clear = function (confirm) {
    if (confirm) {
        this.db = [];
        this._autoUpdate();
    }
    else {
        NDDB.log('Do you really want to clear the current dataset? Please use clear(true)', 'WARN');
    }
    
    return confirm;
};    


// ## Advanced operations

/**
 * ### NDDB.join
 *
 * Performs a *left* join across all the entries of the database
 * 
 * @param {string} key1 First property to compare  
 * @param {string} key2 Second property to compare
 * @param {string} pos Optional. The property under which the join is performed. Defaults 'joined'
 * @param {string|array} select Optional. The properties to copy in the join. Defaults undefined 
 * @return {NDDB} A new database containing the joined entries
 * 
 * 	@see NDDB._join
 * 	@see NDDB.breed
 * 
 * 
 */
NDDB.prototype.join = function (key1, key2, pos, select) {
// <!--	
    // Construct a better comparator function
    // than the generic JSUS.equals
//        if (key1 === key2 && 'undefined' !== typeof this.__C[key1]) {
//            var comparator = function(o1,o2) {
//                if (this.__C[key1](o1,o2) === 0) return true;
//                return false;
//            }
//        }
//        else {
//            var comparator = JSUS.equals;
//        }
// -->	
    return this._join(key1, key2, JSUS.equals, pos, select);
};

/**
 * ### NDDB.concat
 *
 * Copies all the entries (or selected properties of them) containing key2 
 * in all the entries containing key1.
 * 
 * Nested properties can be accessed with '.'.
 * 
 * @param {string} key1 First property to compare  
 * @param {string} key2 Second property to compare
 * @param {string} pos Optional. The property under which the join is performed. Defaults 'joined'
 * @param {string|array} select Optional. The properties to copy in the join. Defaults undefined 
 * @return {NDDB} A new database containing the concatenated entries
 * 
 *  @see NDDB._join
 *  @see JSUS.join
 */
NDDB.prototype.concat = function (key1, key2, pos, select) {        
    return this._join(key1, key2, function(){ return true;}, pos, select);
};

/**
 * ### NDDB._join
 *
 * Performs a *left* join across all the entries of the database
 * 
 * The values of two keys (also nested properties are accepted) are compared
 * according to the specified comparator callback, or using JSUS.equals.
 * 
 * If the comparator function returns TRUE, matched entries are appended 
 * as a new property of the matching one. 
 * 
 * By default, the full object is copied in the join, but it is possible to 
 * specify the name of the properties to copy as an input parameter.
 * 
 * A new NDDB object breeded, so that further operations can be chained.
 * 
 * @api private
 * @param {string} key1 First property to compare  
 * @param {string} key2 Second property to compare
 * @param {function} comparator Optional. A comparator function. Defaults JSUS.equals
 * @param {string} pos Optional. The property under which the join is performed. Defaults 'joined'
 * @param {string|array} select Optional. The properties to copy in the join. Defaults undefined 
 * @return {NDDB} A new database containing the joined entries
 * 	@see NDDB.breed
 * 
 *  * TODO: check do we need to reassign __nddbid__ ?
 */
NDDB.prototype._join = function (key1, key2, comparator, pos, select) {
	if (!key1 || !key2) return this.breed([]);
	
    comparator = comparator || JSUS.equals;
    pos = ('undefined' !== typeof pos) ? pos : 'joined';
    if (select) {
        select = (select instanceof Array) ? select : [select];
    }
    var out = [], idxs = [], foreign_key, key;
    
    for (var i=0; i < this.db.length; i++) {
       
       foreign_key = JSUS.getNestedValue(key1, this.db[i]);
       if ('undefined' !== typeof foreign_key) { 
    	   for (var j=i+1; j < this.db.length; j++) {
           
    		   key = JSUS.getNestedValue(key2, this.db[j]);
               
               if ('undefined' !== typeof key) { 
            	   if (comparator(foreign_key, key)) {
	                    // Inject the matched obj into the
	                    // reference one
	                    var o = JSUS.clone(this.db[i]);
	                    var o2 = (select) ? JSUS.subobj(this.db[j], select) : this.db[j];
	                    o[pos] = o2;
	                    out.push(o);
            	   }
                    
                }
            }
        }
    }
    
    return this.breed(out);
};

/**
 * ### NDDB.split
 *
 * Splits all the entries in the database containing
 * the passed dimension. 
 * 
 * New entries are created and a new NDDB object is
 * breeded to allows method chaining.
 * 
 * @param {string} key The dimension along which splitting the entries
 * @return {NDDB} A new database containing the split entries
 * 
 * 	@see NDDB._split
 * 
 */
NDDB.prototype.split = function (key) {    
    var out = [];
    for (var i=0; i < this.db.length;i++) {
        out = out.concat(JSUS.split(this.db[i], key));
    }
    return this.breed(out);
};

// ## Fetching

/**
 * ### NDDB.fetch
 *
 * Fetches all the entries in the database and returns 
 * them in one array 
 * 
 * Examples
 * 
 * ```javascript
 * var db = new NDDB();
 * db.insert([ { a:1, b:{c:2}, d:3 } ]);
 * 
 * db.fetch();    // [ {a: 1, b: {c: 2}, d: 3} ] 
 * ```
 * 
 * No further chaining is permitted after fetching.
 *  
 * @return {array} out The fetched values 
 * 
 * @see NDDB.fetchValues
 * @see NDDB.fetchArray
 * @see NDDB.fetchKeyArray
 * @see NDDB.fetchSubObj
 * 
 */
NDDB.prototype.fetch = function () {
    return this.db;
};

/**
 * ### NDDB.fetchSubObj
 *
 * Fetches all the entries in the database and trims out unwanted properties
 * 
 * 
 * Examples
 * 
 * ```javascript
 * var db = new NDDB();
 * db.insert([ { a:1, b:{c:2}, d:3 } ]);
 * db.insert([ { a:4, b:{c:5}, d:6 } ]);
 * 
 * db.fetchSubObj('a'); // [ { a: 1} , {a: 4}]
 * ```
 * 
 * No further chaining is permitted after fetching.
 * 
 * @param {string|array} key Optional. If set, returned objects will have only such properties  
 * @return {array} out The fetched objects 
 * 
 * @see NDDB.fetch
 * @see NDDB.fetchValues
 * @see NDDB.fetchArray
 * @see NDDB.fetchKeyArray
 */
NDDB.prototype.fetchSubObj= function (key) {
	if (!key) return [];
	var i, el, out = [];
	for (i=0; i < this.db.length; i++) {
	    el = JSUS.subobj(this.db[i], key);
	    if (!JSUS.isEmpty(el)) out.push(el);
    }
    return out;
};


/**
 * ### NDDB.fetchValues
 *
 * Fetches all the values of the entries in the database
 * 
 * The type of the input parameter determines the return value:
 *  - if it is `string`, returned value is a one-dimensional array. 
 * 	- if it is `array`, returned value is an object whose properties are arrays containing 
 * all the values found in the database for those keys.
 *   
 * Nested properties can be specified too.  
 *   
 * Examples
 * 
 * ```javascript
 * var db = new NDDB();
 * db.insert([ { a:1, b:{c:2}, d:3 } ]);
 * 
 * db.fetchValues();    // [ [ 1, 2, 3 ] ]
 * db.fetchValues('b'); // { b: [ {c: 2} ] }
 * db.fetchValues('d'); // { d: [ 3 ] };
 * 
 * db.insert([ { a:4, b:{c:5}, d:6 } ]);
 * 
 * db.fetchValues([ 'a', 'd' ]); // { a: [ 1, 4] , d: [ 3, 6] };
 * ```
 * 
 * No further chaining is permitted after fetching.
 * 
 * @param {string|array} key Optional. If set, returns only the value from the specified property 
 * @return {array} out The fetched values 
 * 
 * @see NDDB.fetch
 * @see NDDB.fetchArray
 * @see NDDB.fetchKeyArray
 * @see NDDB.fetchSubObj
 * 
 */
NDDB.prototype.fetchValues = function(key) {
	var el, i, out, typeofkey;
	
	typeofkey = typeof key, out = {};
	
	if (typeofkey === 'undefined') {	
		for (i=0; i < this.db.length; i++) {
			JSUS.augment(out, this.db[i], JSUS.keys(this.db[i]));
		} 
	}
	
	else if (typeofkey === 'string') {
		out[key] = [];
		for (i=0; i < this.db.length; i++) {
			el = JSUS.getNestedValue(key, this.db[i]);
	        if ('undefined' !== typeof el) {
	        	out[key].push(el);
	        }
		}
		
		
	}
		
	else if (JSUS.isArray(key)) {
    	out = JSUS.melt(key,JSUS.rep([],key.length)); // object not array  
        for (i=0; i < this.db.length; i++) {
        	el = JSUS.subobj(this.db[i], key);
        	if (!JSUS.isEmpty(el)) {
            	JSUS.augment(out, el);
            }
        }   
	}
	
    return out;
};

function getValuesArray(o, key) {
	return JSUS.obj2Array(o, 1);
};

function getKeyValuesArray(o, key) {
	return JSUS.obj2KeyedArray(o, 1);
};


function getValuesArray_KeyString(o, key) {
    var el = JSUS.getNestedValue(key, o);
    if ('undefined' !== typeof el) {
        return JSUS.obj2Array(el,1);
    }
};

function getValuesArray_KeyArray(o, key) {
    var el = JSUS.subobj(o, key);
    if (!JSUS.isEmpty(el)) {
    	return JSUS.obj2Array(el,1);
	}
};


function getKeyValuesArray_KeyString(o, key) {
    var el = JSUS.getNestedValue(key, o);
    if ('undefined' !== typeof el) {
        return key.split('.').concat(JSUS.obj2KeyedArray(el));
    }
};

function getKeyValuesArray_KeyArray(o, key) {
	var el = JSUS.subobj(o, key);
    if (!JSUS.isEmpty(el)) {
        return JSUS.obj2KeyedArray(el);
    	//return key.split('.').concat(JSUS.obj2KeyedArray(el));
	}
};

/**
 * ### NDDB._fetchArray
 *
 * Low level primitive for fetching the entities as arrays 
 * 
 * Examples
 * 
 * ```javascript
 * var db = new NDDB();
 * var items = [{a:1, b:2}, {a:3, b:4}, {a:5, c:6}];
 * db.importDB(items);
 * 
 * db._fetch(null, 'VALUES'); 
 * // [ [ 1, 2 ], [ 3, 4 ], [ 5, 6] ]
 * 
 * db._fetch(null, 'KEY_VALUES'); 
 * // [ [ 'a', 1, 'b', 2 ], [ 'a', 3, 'b', 4 ], [ 'a', 5, 'c', 6 ] ]
 * 
 * db._fetch('a', 'VALUES'); 
 * //  [ [ 1 ], [ 3 ], [ 5 ] ]
 * 
 * db._fetch('a', 'KEY_VALUES'); 
 * // [ [ 'a', 1 ], [ 'a', 3 ], [ 'a', 5 ] ] 
 * 
 * db._fetch(['a','b'], 'VALUES'); 
 * //  [ [ 1 , 2], [ 3, 4 ], [ 5 ] ]
 * 
 * db._fetch([ 'a', 'c'] 'KEY_VALUES'); 
 * // [ [ 'a', 1 ], [ 'a', 3 ], [ 'a', 5, 'c', 6 ] ]
 * ```
 * 
 * No further chaining is permitted after fetching.
 * 
 * @api private
 * @param {string|array} key Optional. If set, returns key/values only from the specified property 
 * @param {boolean} keyed. Optional. If set, also the keys are returned
 * @return {array} out The fetched values 
 * 
 */
NDDB.prototype._fetchArray = function (key, keyed) {
	
    var cb, out, el, i;
    
    if (keyed) {
    	
    	if (!key) cb = getKeyValuesArray;
    	
    	else if ('string' === typeof key) {
    		cb = getKeyValuesArray_KeyString;
    	}
    	else {
    		cb = getKeyValuesArray_KeyArray;
    	}
    }
    else {
    	if (!key) cb = getValuesArray;
    	
    	else if ('string' === typeof key) {
    		cb = getValuesArray_KeyString;
    	}
    	else {
    		cb = getValuesArray_KeyArray;
    	}
    }
    
    out = [];
    for (i=0; i < this.db.length; i++) {
        el = cb.call(this.db[i], this.db[i], key);
        if ('undefined' !== typeof el) out.push(el);
    }    
    
    return out;
}

/**
 * ### NDDB.fetchArray
 *
 * Fetches the entities in the database as arrays instead of objects
 * 
 * Examples
 * 
 * ```javascript
 * var db = new NDDB();
 * db.insert([ { a:1, b:{c:2}, d:3 } ]);
 * db.insert([ { a:4, b:{c:5}, d:6 } ]);
 * 
 * db.fetchArray();     // [ [ 1, 'c', 2, 3 ],  ]
 * db.fetchArray('b');  // [ [ 'c', 2 ] ] 
 * db.fetchArray('d');  // [ [ 3 ] ]
 * ```
 * 
 * No further chaining is permitted after fetching.
 * 
 * @see NDDB._fetchArray
 * @see NDDB.fetchValues
 * @see NDDB.fetchKeyArray
 * @see NDDB.fetchSubObj
 */
NDDB.prototype.fetchArray = function (key) {
    return this._fetchArray(key);
};

/**
 * ### NDDB.fetchKeyArray
 *
 * Exactly as NDDB.fetchArray, but also the keys are added to the
 * returned values. 
 * 
 * Examples
 * 
 * ```javascript
 * var db = new NDDB();
 * db.insert([ { a:1, b:{c:2}, d:3 } ]);
 * 
 * db.fetchKeyArray();       // [ [ 'a', 1, 'c', 2, 'd', 3 ] ]
 * db.fetchKeyArray('b'); // [ [ 'b', 'c', 2 ] ] 
 * db.fetchKeyArray('d');    // [ [ 'd', 3 ] ]
 * ```
 * 
 * No further chaining is permitted after fetching.
 * 
 * @param {string} key Optional. If set, returns only the value from the specified property 
 * @return {array} out The fetched values 
 * 
 * @see NDDB._fetchArray
 * @see NDDB.fetchArray
 * @see NDDB.fetchValues
 * @see NDDB.fetchSubObj
 */
NDDB.prototype.fetchKeyArray = function (key) {
    return this._fetchArray(key, true);
};
            
/**
 * ### NDDB.groupBy
 *
 * Splits the entries in the database in subgroups
 * 
 * Each subgroup is formed up by elements which have the
 * same value along the specified dimension. 
 * 
 * An array of NDDB instances is returned, therefore no direct 
 * method chaining is allowed afterwards. 
 * 
 * Entries containing undefined values in the specified
 * dimension will be skipped
 * 
 * Examples
 * 
 * ```javascript
 * var db = new NDDB();
 * var items = [{a:1, b:2}, {a:3, b:4}, {a:5}, {a:6, b:2}];
 * db.importDB(items);
 * 
 * var groups = db.groupBy('b'); 
 * groups.length; // 2
 * 
 * groups[0].fetch(); // [ { a: 1, b: 2 }, { a: 6, b: 2 } ]
 * 
 * groups[1].fetch(); // [ { a: 3, b: 4 } ]
 * ```
 * 
 * @param {string} key If the dimension for grouping 
 * @return {array} outs The array of groups 
 * 
 */
NDDB.prototype.groupBy = function (key) {
    if (!key) return this.db;
    
    var groups = [];
    var outs = [];
    for (var i=0; i < this.db.length; i++) {
        var el = JSUS.getNestedValue(key, this.db[i]);
        if ('undefined' === typeof el) continue;
        // Creates a new group and add entries to it
        if (!JSUS.in_array(el, groups)) {
            groups.push(el);
            var out = this.filter(function (elem) {
                if (JSUS.equals(JSUS.getNestedValue(key, elem), el)) {
                    return this;
                }
            });
            
            // Reset nddb_pointer in subgroups
            out.nddb_pointer = 0;
            
            outs.push(out);
        }
        
    }
    return outs;
};    

// ## Statistics

/**
 * ### NDDB.count
 *
 * Counts the entries containing the specified key 
 * 
 * If key is undefined, the size of the databse is returned.
 * 
 * @param {string} key The dimension to count
 * @return {number} count The number of items along the specified dimension
 * 
 * 	@see NDDB.length
 */
NDDB.prototype.count = function (key) {
    if ('undefined' === typeof key) return this.db.length;
    var count = 0;
    for (var i = 0; i < this.db.length; i++) {
        if (JSUS.hasOwnNestedProperty(key, this.db[i])){
            count++;
        }
    }    
    return count;
};


/**
 * ### NDDB.sum
 *
 * Returns the total sum of the values of all the entries 
 * in the database containing the specified key. 
 * 
 * Non numeric values are ignored. 
 * 
 * @param {string} key The dimension to sum
 * @return {number|boolean} sum The sum of the values for the dimension, or FALSE if it does not exist
 * 
 */
NDDB.prototype.sum = function (key) {
	if ('undefined' === typeof key) return false;
    var sum = 0;
    for (var i=0; i < this.db.length; i++) {
        var tmp = JSUS.getNestedValue(key, this.db[i]);
        if (!isNaN(tmp)) {
            sum += tmp;
        }
    }    
    return sum;
};

/**
 * ### NDDB.mean
 *
 * Returns the average of the values of all the entries 
 * in the database containing the specified key. 
 * 
 * Entries with non numeric values are ignored, and excluded
 * from the computation of the mean.
 * 
 * @param {string} key The dimension to average
 * @return {number|boolean} The mean of the values for the dimension, or FALSE if it does not exist
 * 
 */
NDDB.prototype.mean = function (key) {
	if ('undefined' === typeof key) return false;
    var sum = 0;
    var count = 0;
    for (var i=0; i < this.db.length; i++) {
        var tmp = JSUS.getNestedValue(key, this.db[i]);
        if (!isNaN(tmp)) { 
            sum += tmp;
            count++;
        }
    }    
    return (count === 0) ? 0 : sum / count;
};

/**
 * ### NDDB.stddev
 *
 * Returns the standard deviation of the values of all the entries 
 * in the database containing the specified key. 
 * 
 * Entries with non numeric values are ignored, and excluded
 * from the computation of the standard deviation.
 * 
 * @param {string} key The dimension to average
 * @return {number|boolean} The mean of the values for the dimension, or FALSE if it does not exist
 * 
 * 	@see NDDB.mean
 */
NDDB.prototype.stddev = function (key) {
	if ('undefined' === typeof key) return false;
    var mean = this.mean(key);
    if (isNaN(mean)) return false;
    
    var V = 0;
    this.each(function(e){
        var tmp = JSUS.getNestedValue(key, e);
        if (!isNaN(tmp)) { 
        	V += Math.pow(tmp - mean, 2)
        }
    });
    
    return (V !== 0) ? Math.sqrt(V) : 0;
};


/**
 * ### NDDB.min
 *
 * Returns the min of the values of all the entries 
 * in the database containing the specified key. 
 * 
 * Entries with non numeric values are ignored. 
 * 
 * @param {string} key The dimension of which to find the min
 * @return {number|boolean} The smallest value for the dimension, or FALSE if it does not exist
 * 
 * 	@see NDDB.max
 */
NDDB.prototype.min = function (key) {
	if ('undefined' === typeof key) return false;
    var min = false;
    for (var i=0; i < this.db.length; i++) {
        var tmp = JSUS.getNestedValue(key, this.db[i]);
        if (!isNaN(tmp) && (tmp < min || min === false)) {
            min = tmp;
        }
    }    
    return min;
};

/**
 * ### NDDB.max
 *
 * Returns the max of the values of all the entries 
 * in the database containing the specified key. 
 * 
 * Entries with non numeric values are ignored. 
 *
 * @param {string} key The dimension of which to find the max
 * @return {number|boolean} The biggest value for the dimension, or FALSE if it does not exist
 * 
 * 	@see NDDB.min
 */
NDDB.prototype.max = function (key) {
	if ('undefined' === typeof key) return false;
    var max = false;
    for (var i=0; i < this.db.length; i++) {
        var tmp = JSUS.getNestedValue(key, this.db[i]);
        if (!isNaN(tmp) && (tmp > max || max === false)) {
            max = tmp;
        }
    }    
    return max;
};
    
// ## Skim

/**
 * ### NDDB.skim
 *
 * Removes the specified properties from all the items in the database 
 *  
 * Use '.' (dot) to point to a nested property.
 * 
 * Items with no property are automatically removed.
 * 
 * @param {string|array} skim The selection of properties to remove
 * @return {NDDB} A new database containing the result of the skim
 * 
 * @see NDDB.keep
 * @see JSUS.skim
 */
NDDB.prototype.skim = function (skim) {
    if (!skim) return this;
    return this.breed(this.map(function(e){
    	var skimmed = JSUS.skim(e, skim); 
    	if (!JSUS.isEmpty(skimmed)) {
    		return skimmed;
    	}
    }));
};

/**
 * ### NDDB.keep
 *
 * Removes all the properties that are not specified as parameter 
 * from all the items in the database
 *  
 * Use '.' (dot) to point to a nested property.
 * 
 * Items with no property are automatically removed.
 * 
 * @param {string|array} skim The selection of properties to keep
 * @return {NDDB} A new database containing the result of the keep operation
 * 
 * @see NDDB.skim
 * @see JSUS.keep
 */
NDDB.prototype.keep = function (keep) {
    if (!keep) return this.breed([]);
    return this.breed(this.map(function(e){
    	var subobj = JSUS.subobj(e, keep);
    	if (!JSUS.isEmpty(subobj)) {
    		return subobj;
    	}
    }));
};

// ## Diff


/**
 * ### NDDB.diff
 *
 * Performs a diff of the entries in the database and the database
 * object passed as parameter (Array or NDDB)
 * 
 * Returns a new NDDB instance containing all the entries that
 * are present in the current instance, and *not* in the 
 * database obj passed as parameter.
 * 
 * @param {NDDB|array} nddb The external database to compare
 * @return {NDDB} A new database containing the result of the diff
 * 
 * @see NDDB.intersect
 * @see JSUS.arrayDiff
 */
NDDB.prototype.diff = function (nddb) {
    if (!nddb || !nddb.length) return this;
    if ('object' === typeof nddb) {
        if (nddb instanceof NDDB || nddb instanceof this.constructor) {
            nddb = nddb.db;
        }
    }
    return this.breed(JSUS.arrayDiff(this.db, nddb));
};

/**
 * ### NDDB.intersect
 *
 * Finds the common the entries between the current database and 
 * the database  object passed as parameter (Array or NDDB)
 * 
 * Returns a new NDDB instance containing all the entries that
 * are present both in the current instance of NDDB and in the 
 * database obj passed as parameter.
 * 
 * @param {NDDB|array} nddb The external database to compare
 * @return {NDDB} A new database containing the result of the intersection
 * 
 * @see NDDB.diff
 * @see JSUS.arrayIntersect
 */
NDDB.prototype.intersect = function (nddb) {
    if (!nddb || !nddb.length) return this;
    if ('object' === typeof nddb) {
        if (nddb instanceof NDDB || nddb instanceof this.constructor) {
            var nddb = nddb.db;
        }
    }
    return this.breed(JSUS.arrayIntersect(this.db, nddb));
};

// ## Iterator


/**
 * ### NDDB.get
 *
 * Returns the entry in the database, at which 
 * the iterator is currently pointing 
 * 
 * If a parameter is passed, then returns the entry
 * with the same internal id. The pointer is *not*
 * automatically updated. 
 * 
 * Returns false, if the pointer is at an invalid position.
 * 
 * @return {object|boolean} The current entry, or FALSE if none is found
 */
NDDB.prototype.get = function (pos) {
    var pos = pos || this.nddb_pointer;
    if (pos < 0 || pos > (this.db.length-1)) {
    	return false;
    }
    return this.db[pos];
};
    
/**
 * ### NDDB.next
 *
 * Moves the pointer to the next entry in the database 
 * and returns it
 * 
 * Returns false if the pointer is at the last entry,
 * or if database is empty.
 * 
 * @return {object|boolean} The next entry, or FALSE if none is found 
 * 
 */
NDDB.prototype.next = function () {
    var el = NDDB.prototype.get.call(this, ++this.nddb_pointer);
    if (!el) this.nddb_pointer--;
    return el;
};

/**
 * ### NDDB.previous
 *
 * Moves the pointer to the previous entry in the database 
 * and returns it
 * 
 * Returns false if the pointer is at the first entry,
 * or if database is empty.
 * 
 * @return {object|boolean} The previous entry, or FALSE if none is found
 */
NDDB.prototype.previous = function () {
    var el = NDDB.prototype.get.call(this, --this.nddb_pointer);
    if (!el) this.nddb_pointer++;
    return el;
};

/**
 * ### NDDB.first
 *
 * Moves the pointer to the first entry in the database,
 * and returns it
 * 
 * Returns the first entry of the database, or undefined 
 * if the database is empty.
 * 
 * @param {string} key Optional. If set, moves to the pointer to the first entry along this dimension
 * @return {object} The first entry found
 * 
 * 	@see NDDB.last
 */
NDDB.prototype.first = function (key) {
    var db = this.fetch(key);
    if (db.length) {
        this.nddb_pointer = 0;
        return db[0];
    }
    return undefined;
};

/**
 * ### NDDB.last
 *
 * Moves the pointer to the first last in the database,
 * and returns it
 * 
 * Returns the last entry of the database, or undefined 
 * if the database is empty.
 * 
 * @param {string} key Optional. If set, moves to the pointer to the last entry along this dimension
 * @return {object} The last entry found
 * 
 * 	@see NDDB.first
 */
NDDB.prototype.last = function (key) {
    var db = this.fetch(key);
    if (db.length) {
        this.nddb_pointer = db.length-1;
        return db[db.length-1];
    }
    return undefined;
};

// ## Tagging


/**
 * ### NDDB.tag
 *
 * Registers a tag associated to an internal id.
 * 
 * @TODO: tag should be updated with shuffling and sorting
 * operations.
 * 
 * @param {string} tag An alphanumeric id
 * @param {string} idx Optional. The index in the database, or the. Defaults nddb_pointer
 * @return {boolean} TRUE, if registration is successful
 * 
 * 	@see NDDB.resolveTag
 */
NDDB.prototype.tag = function (tag, idx) {
    if ('undefined' === typeof tag) {
        NDDB.log('Cannot register empty tag.', 'ERR');
        return false;
    }
    
    var ref = null, typeofIdx = typeof idx;
    
    if (typeofIdx === 'undefined') {
    	ref = this.db[this.nddb_pointer];
    }
    else if (typeofIdx === 'number') {
    	
    	if (idx > this.length || idx < 0) {
            NDDB.log('Invalid index provided for tag registration', 'ERR');
            return false;
        }
    	ref = this.db[idx];
    }
    else {
    	ref = idx;
    }
    
    this.tags[tag] = ref;
    return true;
};

/**
 * ### NDDB.resolveTag
 *
 * Returns the element associated with the given tag.
 * 
 * @param {string} tag An alphanumeric id
 * @return {object} The object associated with the tag
 * 
 * 	@see NDDB.tag
 * @status: experimental
 */
NDDB.prototype.resolveTag = function (tag) {
    if ('undefined' === typeof tag) {
    	NDDB.log('Cannot resolve empty tag.', 'ERR');
    	return false;
    }
    return this.tags[tag];
};

// ## Persistance    

var storageAvailable = function() {
	return ('function' === typeof store);
}

// if node
if (JSUS.isNodeJS()) {   
	require('./external/cycle.js');		
	var fs = require('fs'),
		csv = require('ya-csv');
};

//end node  

/**
 * ### NDDB.save
 * 
 * Saves the database to a persistent medium in JSON format
 * 
 * If NDDB is executed in the browser, it tries to use the `store` method - 
 * usually associated to shelf.js - to write to the browser database. 
 * If no `store` object is found, an error is issued and the database
 * is not saved.
 * 
 * If NDDB is executed in the Node.JS environment it saves to the file system
 * using the standard `fs.writeFile` method.
 * 
 * Cyclic objects are decycled, and do not cause errors. Upon loading, the cycles
 * are restored.
 * 
 * @param {string} file The file system path, or the identifier for the browser database
 * @param {function} callback Optional. A callback to execute after the database was saved
 * @param {compress} boolean Optional. If TRUE, output will be compressed. Defaults, FALSE
 * @return {boolean} TRUE, if operation is successful
 * 
 * @see NDDB.load
 * @see NDDB.stringify
 * @see https://github.com/douglascrockford/JSON-js/blob/master/cycle.js

 * 
 */
NDDB.prototype.save = function (file, callback, compress) {
	if (!file) {
		NDDB.log('You must specify a valid file / id.', 'ERR');
		return false;
	}
	
	compress = compress || false;
	
	// Try to save in the browser, e.g. with Shelf.js
	if (!JSUS.isNodeJS()){
		if (!storageAvailable()) {
			NDDB.log('No support for persistent storage found.', 'ERR');
			return false;
		}
		
		store(file, this.stringify(compress));
		if (callback) callback();
		return true;
	}
	
	// Save in Node.js
	fs.writeFileSync(file, this.stringify(compress), 'utf-8');
	if (callback) callback();
	return true;
	
};

/**
 * ### NDDB.load
 * 
 * Loads a JSON object into the database from a persistent medium
 * 
 * If NDDB is executed in the browser, it tries to use the `store` method - 
 * usually associated to shelf.js - to load from the browser database. 
 * If no `store` object is found, an error is issued and the database
 * is not loaded.
 * 
 * If NDDB is executed in the Node.JS environment it loads from the file system
 * using the standard `fs.readFileSync` or `fs.readFile` method.
 * 
 * Cyclic objects previously decycled will be retrocycled. 
 * 
 * @param {string} file The file system path, or the identifier for the browser database
 * @param {function} cb Optional. A callback to execute after the database was saved
 * @return {boolean} TRUE, if operation is successful
 * 
 * @see NDDB.save
 * @see NDDB.stringify
 * @see JSUS.parse
 * @see https://github.com/douglascrockford/JSON-js/blob/master/cycle.js
 * 
 */
NDDB.prototype.load = function (file, cb, options) {
	if (!file) {
		NDDB.log('You must specify a valid file / id.', 'ERR');
		return false;
	}
	
	// Try to save in the browser, e.g. with Shelf.js
	if (!JSUS.isNodeJS()){
		if (!storageAvailable()) {
			NDDB.log('No support for persistent storage found.', 'ERR');
			return false;
		}
		
		var items = store(file);
		this.importDB(items);
		if (cb) cb();
		return true;
	}
	
	var loadString = function(s) {

		var items = JSUS.parse(s);
		
		var i;
		for (i=0; i< items.length; i++) {
			// retrocycle if possible
			items[i] = NDDB.retrocycle(items[i]);
		}

		this.importDB(items);
	}
	
	var s = fs.readFileSync(file, 'utf-8');	
	loadString.call(this, s);
	return true;
};
	

NDDB.prototype.load.csv = function (file, cb, options) {
	if (!file) {
		NDDB.log('You must specify a valid CSV file.', 'ERR');
		return false;
	}
	
	if (!JSUS.isNodeJS()){
		NDDB.log('Loading a CSV file is available only in Node.js environment.', 'ERR');
		return false;
	}
	
	// Mix options
	options = options || {};
	 
	if ('undefined' === typeof options.columnsFromHeader) {
		options.columnsFromHeader = true;
	}


	var reader = csv.createCsvStreamReader(file, options);

	if (options.columnNames) {
		reader.setColumnNames(options.columnNames);
	}
	
	reader.addListener('data', function(data) {
	    this.insert(data);
	});
	
	reader.addListener('end', function(data) {
		if (cb) callback();
	});
	
	return true;
};


// ## Closure    
})(
    'undefined' !== typeof module && 'undefined' !== typeof module.exports ? module.exports: window
  , 'undefined' !== typeof JSUS ? JSUS : module.parent.exports.JSUS || require('JSUS').JSUS
  , ('object' === typeof module && 'function' === typeof require) ? module.parent.exports.store || require('shelf.js/build/shelf-fs.js').store : this.store
);
