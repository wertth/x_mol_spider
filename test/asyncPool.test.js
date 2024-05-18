import { expect } from 'chai';
import { AsyncPool } from '../src/asyncPool.js';  // 替换为实际路径
import axios from 'axios';

describe('AsyncPool', function() {
  this.timeout(80000)
  it('should execute tasks at the specified frequency', async function() {
    const tasks = [
      () => new Promise(resolve => setTimeout(() => resolve('task1 done'), 100)),
      async () => await axios.get("https://www.baidu.com").then(res=>res.data.slice(0,10)) 
    ];
    const asyncPool = new AsyncPool(tasks, 0.1);

    await asyncPool.run();

    const results = (await asyncPool.getResults()).flat();
    const totalElapsed = asyncPool.m_totalElapsed;

    expect(results).to.have.members([
      'task1 done',
      '<!DOCTYPE '
    ]);
    expect(totalElapsed).to.be.above(Math.floor(tasks.length / 0.1) * 1000);
  });

  // it('should push tasks to the front of the queue', async function() {
  //   const tasks = [
  //     new Promise(resolve => setTimeout(() => resolve('task1 done'), 100)),
  //     new Promise(resolve => setTimeout(() => resolve('task2 done'), 100)),
  //     new Promise(resolve => setTimeout(() => resolve('task3 done'), 100))
  //   ];
  //   const asyncPool = new AsyncPool(tasks, 3);

  //   asyncPool.push_front(new Promise(resolve => setTimeout(() => resolve('task0 done'), 100)));

  //   await asyncPool.run();

  //   const results = (await asyncPool.getResults()).flat();
  //   const totalElapsed = asyncPool.m_totalElapsed;

  //   expect(results).to.have.members([
  //     'task0 done',
  //     'task1 done',
  //     'task2 done',
  //     'task3 done'
  //   ]);
  //   expect(totalElapsed).to.be.above(Math.floor(results.length / 3) * 1000);
  // });

  // it('should push tasks to the queue during run', async function() {
  //   const tasks = [
  //     new Promise(resolve => setTimeout(() => resolve('task1 done'), 100)),
  //     new Promise(resolve => setTimeout(() => resolve('task2 done'), 100)),
  //     new Promise(resolve => setTimeout(() => resolve('task3 done'), 100))
  //   ];
  //   const asyncPool = new AsyncPool(tasks, 2);

  //   setTimeout(() => asyncPool.push(new Promise(resolve => setTimeout(() => resolve('task4 done'), 100))), 200);
  //   setTimeout(() => asyncPool.push(new Promise(resolve => setTimeout(() => resolve('task5 done'), 100))), 300);

  //   await asyncPool.run();

  //   const results = (await asyncPool.getResults()).flat();
  //   const totalElapsed = asyncPool.m_totalElapsed;

  //   expect(results).to.have.members([
  //     'task1 done',
  //     'task2 done',
  //     'task3 done',
  //     'task4 done',
  //     'task5 done'
  //   ]);
  //   expect(totalElapsed).to.be.above(Math.floor(results.length / 2) * 1000);
  // });

  // it('should push tasks to the front of the queue during run', async function() {
  //   const tasks = [
  //     new Promise(resolve => setTimeout(() => resolve('task1 done'), 100)),
  //     new Promise(resolve => setTimeout(() => resolve('task2 done'), 100)),
  //     new Promise(resolve => setTimeout(() => resolve('task3 done'), 100))
  //   ];
  //   const asyncPool = new AsyncPool(tasks, 2);

  //   setTimeout(() => asyncPool.push_front(new Promise(resolve => setTimeout(() => resolve('task0 done'), 100))), 200);
  //   setTimeout(() => asyncPool.push(new Promise(resolve => setTimeout(() => resolve('task4 done'), 100))), 300);

  //   await asyncPool.run();

  //   const results = (await asyncPool.getResults()).flat();
  //   const totalElapsed = asyncPool.m_totalElapsed;

  //   expect(results).to.have.members([
  //     'task1 done',
  //     'task2 done',
  //     'task0 done',
  //     'task3 done',
  //     'task4 done'
  //   ]);
  //   expect(totalElapsed).to.be.above(Math.floor(results.length / 2) * 1000);
  // });

  // it('should clear all tasks and results', async function() {
  //   const tasks = [
  //     new Promise(resolve => setTimeout(() => resolve('task1 done'), 100)),
  //     new Promise(resolve => setTimeout(() => resolve('task2 done'), 100))
  //   ];
  //   const asyncPool = new AsyncPool(tasks, 2);

  //   asyncPool.clear();

  //   await asyncPool.run();

  //   const results = (await asyncPool.getResults()).flat();

  //   expect(results).to.be.empty;
  //   expect(asyncPool.taskNum).to.equal(0);
  // });

  // it('should handle task failures', async function() {
  //   const tasks = [
  //     new Promise((_, reject) => setTimeout(() => reject(new Error('task1 failed')), 100)),
  //     new Promise(resolve => setTimeout(() => resolve('task2 done'), 100))
  //   ];
  //   const asyncPool = new AsyncPool(tasks, 2);

  //   await asyncPool.run();

  //   const results = (await asyncPool.getResults()).flat();

  //   expect(results).to.include.members(['task2 done']);
  //   expect(results).to.include.members(['task1 failed']);
  // });

  // it('should not run tasks again if already running', async function() {
  //   const tasks = [
  //     new Promise(resolve => setTimeout(() => resolve('task1 done'), 100)),
  //     new Promise(resolve => setTimeout(() => resolve('task2 done'), 100))
  //   ];
  //   const asyncPool = new AsyncPool(tasks, 2);

  //   asyncPool.run();
  //   asyncPool.run();  // This should not restart the pool

  //   await new Promise(resolve => setTimeout(resolve, 500));  // Wait enough time to ensure tasks complete

  //   const results = await asyncPool.getResults();
  //   const totalElapsed = asyncPool.m_totalElapsed;

  //   expect(results.flat()).to.have.members(['task1 done', 'task2 done']);
  //   expect(totalElapsed).to.be.above(200);
  // });

  // it('should flatten results with tasks inserted at both ends during run', async function() {
  //   const tasks = [
  //     new Promise(resolve => setTimeout(() => resolve(['task1 done']), 100)),
  //     new Promise(resolve => setTimeout(() => resolve(['task2 done']), 100)),
  //     new Promise(resolve => setTimeout(() => resolve(['task3 done']), 100))
  //   ];
  //   const asyncPool = new AsyncPool(tasks, 2);

  //   setTimeout(() => asyncPool.push_front(new Promise(resolve => setTimeout(() => resolve(['task0 done']), 100))), 200);
  //   setTimeout(() => asyncPool.push(new Promise(resolve => setTimeout(() => resolve(['task4 done']), 100))), 300);

  //   await asyncPool.run();

  //   const results = await asyncPool.getResults();
  //   const totalElapsed = asyncPool.m_totalElapsed;

  //   expect(results.flat()).to.have.members([
  //     'task0 done',
  //     'task1 done',
  //     'task2 done',
  //     'task3 done',
  //     'task4 done'
  //   ]);
  //   expect(totalElapsed).to.be.above(Math.floor(results.length / 2) * 1000);
  // });
});
