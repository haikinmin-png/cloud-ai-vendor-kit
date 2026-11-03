// A mock vendor adapter with the same shape as a real one, so the whole
// product (UI, task flow, billing) can be built and demoed before any API
// contract is signed or any secret exists. Swap it for a real adapter
// behind the same interface when keys arrive — in env config, never in code.
export class MockAdapter {
  constructor({ stepsToSucceed = 2 } = {}) {
    this.tasks = new Map();
    this.stepsToSucceed = stepsToSucceed;
    this.counter = 0;
  }

  async faceswap({ imageUrl, templateId }) {
    if (!imageUrl || !templateId) throw new Error('imageUrl and templateId are required');
    return { status: 'succeeded', resultUrl: `mock://faceswap/${templateId}/${++this.counter}` };
  }

  async animateSubmit({ imageUrl, templateId }) {
    if (!imageUrl || !templateId) throw new Error('imageUrl and templateId are required');
    const taskId = `mock-task-${++this.counter}`;
    this.tasks.set(taskId, { polls: 0, templateId });
    return { taskId, status: 'pending' };
  }

  async taskGet(taskId) {
    const task = this.tasks.get(taskId);
    if (!task) throw new Error(`Unknown task: ${taskId}`);
    task.polls += 1;
    if (task.polls >= this.stepsToSucceed) {
      return { status: 'succeeded', resultUrl: `mock://animate/${task.templateId}/${taskId}` };
    }
    return { status: task.polls === 1 ? 'pending' : 'running' };
  }

  async stylize({ imageUrl, styleId }) {
    if (!imageUrl || !styleId) throw new Error('imageUrl and styleId are required');
    return { status: 'succeeded', resultUrl: `mock://stylize/${styleId}/${++this.counter}` };
  }
}
