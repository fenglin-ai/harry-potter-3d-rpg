# 第三方依赖

## Three.js（r160，UMD 构建）

- 文件：`js/vendor/three.min.js`
- 官网：https://threejs.org
- 仓库：https://github.com/mrdoob/three.js
- 协议：MIT License，Copyright 2010-2023 Three.js Authors

本项目将其作为本地内置依赖（vendor），不依赖 CDN，因此离线也能运行。

```text
MIT License

Copyright 2010-2023 Three.js Authors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

除 Three.js 外，本项目不使用任何第三方图片、音频、字体或模型资源：
所有场景、角色、道具均由代码程序化生成，音效使用 Web Audio API 实时合成。
