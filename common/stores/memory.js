// TODO: clear completed tasks
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
    // Todo: delete tasks that have completed
    this.tasks[task.id] = task;
  }
}

module.exports = MemoryTaskStore;
