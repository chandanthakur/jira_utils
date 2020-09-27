var utils = require('./utils');
class Queue {
    constructor() {
        this.arr = [];
    }

    poll() {
        if(this.arr.length < 1) return null;
        return this.arr.shift();
    }

    push(val) {
        this.arr.push(val);
    }
}

class Worker {
    constructor(name, queue, onIdleStateChange) {
        this.name = name;
        this.queue = queue;
        this.isStopped = false;
        this.busy = false;
        this.idleCount = 0;
        this.wait = 10;
        this.onIdleStateChange = onIdleStateChange;
        //console.log("Initialized worker: " + this.name);
    }

    get isIdle(){
        return !this.busy;
    }

    doWork() {
        if(this.isStopped) return;
        let task = this.queue.poll();
        let ctx = this;
        if (task) {
            if(!this.busy) {
                this.busy = true;
                this.onIdleStateChange(this.name, this.busy);
            }

            this.idleCount = 0;
            //this.log("Executing Task: " + task.name);
            try { 
                task.execute(function(){
                    ctx.doWorkWithTimeout(0)
                }, function(){
                    ctx.doWorkWithTimeout(0);
                }); 
            } catch(e) {
                ctx.doWorkWithTimeout(0);
            }
        } else {
            this.idleCount++;
            if (this.idleCount > 50 && this.busy == true) {
                this.busy = false;
                this.onIdleStateChange(this.name, this.busy);
            } 
    
            this.doWorkWithTimeout(this.wait);
        }
    }

    doWorkWithTimeout(t) {
        let ctx = this;
        setTimeout(function(){
            ctx.doWork();
        }, t);
    }

    start() {
        this.doWork();
    }

    stop() {
        this.isStopped = true;
    }

    log(text) {
        utils.log(this.name + ":" + text);
    }
}

class Task {
    constructor(name, args, work) {
        this.name = name;
        this.work = work;
        this.args = args;
    }

    execute(onSuccess, onError) {
        this.work(this.args, onSuccess, onError);
    }
}

class WorkerPool {
    constructor(n, onComplete) {
        this.count = n;
        this.queue = new Queue();
        this.workers = [];
        this.onComplete = onComplete;
        for(let kk = 0; kk < n; kk++) {
            let name = "Worker-" + kk;
            this.workers.push(new Worker(name, this.queue, this.onIdleStateChange.bind(this)));
        }
    }

    addTask(task) {
        this.queue.push(task);
    }

    start() {
        this.workers.forEach(w => w.start());
    }

    stop() {
        this.workers.forEach(w => w.stop());
        this.onComplete();
    }

    onIdleStateChange(workerId, status) {
        let idleWorkers = 0;
        this.workers.forEach(function(w) {
            if(w.isIdle) idleWorkers = idleWorkers + 1;
        });

        if(idleWorkers == this.workers.length) this.stop();
    }
}

module.exports = {
    WorkerPool: WorkerPool,
    Task: Task
}