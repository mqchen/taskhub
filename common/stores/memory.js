

class MemoryTaskStore {
  constructor() {
    this.tasks = {};
  }

  async get(taskId) {
    return this.tasks[taskId];
  }

  async add(task) {
    this.tasks[task.id] = task;
    return task;
  }

  update(task) {
    this.tasks[task.id] = task;
  }
}

module.exports = MemoryTaskStore;
