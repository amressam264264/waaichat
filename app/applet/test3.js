import fetch from 'node-fetch';

async function test() {
  const url = 'https://pollinations.ai/prompt/test';
  try {
    const res = await fetch(url);
    const text = await res.text();
    console.log(`RESULT: ${res.status} ${text.substring(0, 100)}`);
  } catch (e) {
    console.log(`Error ${e.message}`);
  }
}

test();
