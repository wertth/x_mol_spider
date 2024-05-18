class AsyncPool {
  constructor(tasks = [], frequency = 20) {
    this.m_tasks = tasks.map((task, index) => ({ task, index }));
    this.m_frequency = frequency;
    this.m_interval = 1000 / frequency;
    this.m_activeTasks = [];
    this.m_running = false;
    this.m_results = new Array(tasks.length).fill(undefined);
    this.m_taskNum = tasks.length;
    // this.m_timer
  }

  set tasks(t) {
    const startIndex = this.m_taskNum;
    this.m_tasks.push(...t.map((task, index) => ({ task, index: startIndex + index })));
    this.m_taskNum += t.length;
    this.m_results.length = this.m_taskNum;
  }

  set frequency(f) {
    this.m_frequency = f;
    this.m_interval = 1000 / f;
  }

  get taskNum() {
    return this.m_taskNum;
  }

  checkAllTaskDone() {
    return this.m_activeTasks.length === 0 && this.m_tasks.length === 0 && !this.m_running;
  }

  async getResults() {
    while (!this.checkAllTaskDone()) {
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    return this.m_results;
  }

  push(task) {
    const index = this.m_taskNum++;
    this.m_tasks.push({ task, index });
    this.m_results.length = this.m_taskNum;
    if (!this.m_running) {
      this.run();
    }
  }

  push_front(task) {
    const index = this.m_taskNum++;
    this.m_tasks.unshift({ task, index });
    this.m_results.length = this.m_taskNum;
    if (!this.m_running) {
      this.run();
    }
  }

  clear() {
    this.m_tasks = [];
    this.m_results = [];
    this.m_taskNum = 0;
  }

  async run() {
    if (this.m_running) return;
    this.m_running = true;
    console.log("====async pool start====");
    const start = Date.now();

    try {
      while (this.m_tasks.length > 0 || this.m_activeTasks.length > 0) {
        await this.scheduleTask()
      }
    } finally {
      this.m_running = false;
      this.m_totalElapsed = Date.now() - start;
      console.log("====async pool end====");
      console.log("Total time: ", this.m_totalElapsed / 1000, 's');
      console.log("Results: ", JSON.stringify(this.m_results));
    }
  }
  async scheduleTask() {
    const start = Date.now();
    while (this.m_activeTasks.length < this.m_frequency && this.m_tasks.length > 0) {
      const { task, index } = this.m_tasks.shift();
      const packedTask = this.packTask(task, index);
      this.m_activeTasks.push(packedTask);
      packedTask.finally(() => {
        const taskIndex = this.m_activeTasks.indexOf(packedTask);
        if (taskIndex !== -1) {
          this.m_activeTasks.splice(taskIndex, 1);
        }
      });
    }
    const num = this.m_activeTasks.length
    await Promise.all(this.m_activeTasks);
    const batchUsedTime = Date.now() - start;
    const waitTime = Math.max(this.m_interval * num - batchUsedTime, 0); // 确保waitTime不为负值
    await new Promise(resolve => setTimeout( resolve , waitTime));  // 等待调度完成
  }
  
  packTask(task, index) {
    return new Promise(async (resolve, reject) => {
      try {
        const res = await task;
        console.log(`Task ${index} completed, result: ${res}`);
        this.m_results[index] = Array.isArray(res) ? res : [res];
        resolve(res);
      } catch (err) {
        console.log(`Task ${index} failed, error: ${err.message}`);
        this.m_results[index] = err.message;
        resolve(err.message);
      }
    });
  }
}

export { AsyncPool };
