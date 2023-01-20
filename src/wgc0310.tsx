import { h } from 'tsx-dom'

const importDynamic = (path: string) => import(/* @vite-ignore */ path)

const createTexture = (gl: WebGLRenderingContext, image: ImageBitmap): WebGLTexture => {
   const texture = gl.createTexture()
   gl.bindTexture(gl.TEXTURE_2D, texture)
   gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image)
   gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
   gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
   gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
   gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
   gl.bindTexture(gl.TEXTURE_2D, null)

   return texture!
}

const initScreenRenderer = (gl: WebGLRenderingContext, glx: any, images: Record<string, ImageBitmap>) => {
   const cx: Record<string, any> = {}

   cx.staticFace = createTexture(gl, images.staticFace)
   cx.wink = createTexture(gl, images.wink)

   const screenVs = String.raw`
precision mediump float;

attribute vec2 aVertexCoord;

varying vec2 uvCoord;

void main() {
  uvCoord = vec2(aVertexCoord.x / 2.0 + 0.5, 1.0 - (aVertexCoord.y / 2.0 + 0.5));
  gl_Position = vec4(aVertexCoord, 0.0, 1.0);
}
`
   const screenFs = String.raw`
precision mediump float;

varying vec2 uvCoord;

uniform sampler2D tex;

void main() {
    gl_FragColor = texture2D(tex, uvCoord);
}
`

   cx.screenShader = glx.createShaderProgram(gl, screenVs, screenFs)
   const vertexCoordPos = cx.screenShader.getAttribLocation(gl, 'aVertexCoord')

   cx.buffer = glx.createVertexBuffer(
      gl,
      [
         -1.0, -1.0,
         1.0, 1.0,
         -1.0, 1.0,

         -1.0, -1.0,
         1.0, -1.0,
         1.0, 1.0
      ],
      {
         stride: 2,
         attributes: [{ position: vertexCoordPos, size: 2, offset: 0 }]
      }
   )

   return [cx, (gl: WebGLRenderingContext) => {
      cx.screenShader.useProgram(gl)
      if (cx.mode === 'wink') {
         gl.bindTexture(gl.TEXTURE_2D, cx.wink)
      } else {
         gl.bindTexture(gl.TEXTURE_2D, cx.staticFace)
      }
      cx.buffer.draw(gl)
   }]
}

const loadWGLite = async () => {
   const { initializeGL, resizeGL, paintGL, initStatus, setScreenRenderer, glx } = await importDynamic('./extra/project-wg-lite.mjs')
   const body = $('body')

   body.appendChild(
      <canvas id="project-wg-lite" width="600" height="600">
      </canvas>
   )

   const canvas = $('#project-wg-lite') as HTMLCanvasElement
   const gl = canvas.getContext('webgl')

   if (!gl) {
      console.warn(`[W] 浏览器不支持 WebGL，电子宠物将不会加载`)
      canvas.remove()
      return
   }

   const modelPath = [
      ['wheelMesh', 'extra/project-wg-model/wheel.bin'],
      ['monitorMesh', 'extra/project-wg-model/monitor.bin'],
      ['monitorIntake', 'extra/project-wg-model/monitor-intake.bin'],

      ['chestBoxMesh', 'extra/project-wg-model/chest-box.bin'],
      ['chestPlateMesh', 'extra/project-wg-model/chest-plate.bin'],
      ['powerMesh', 'extra/project-wg-model/power.bin'],
      ['powerPinMesh', 'extra/project-wg-model/power-pin.bin'],

      ['abdomenMesh', 'extra/project-wg-model/abdomen.bin'],
      ['waistMesh', 'extra/project-wg-model/waist.bin'],

      ['shoulderConnectorMesh', 'extra/project-wg-model/shoulder-connector.bin'],
      ['shoulderPlateMesh', 'extra/project-wg-model/shoulder-plate.bin'],
      ['bigArmMesh', 'extra/project-wg-model/big-arm.bin'],
      ['bigArmCoverMesh', 'extra/project-wg-model/big-arm-cover.low-poly.bin'],
      ['bigArmConnectorMesh', 'extra/project-wg-model/big-arm-connector.bin'],
      ['smallArmMesh', 'extra/project-wg-model/small-arm.bin'],
      ['smallArmCoverMesh', 'extra/project-wg-model/small-arm-cover.low-poly.bin'],
      ['wheelSmallMesh', 'extra/project-wg-model/wheel-small.bin'],
      ['clawMesh', 'extra/project-wg-model/claw.bin'],
      ['clawCoverMesh', 'extra/project-wg-model/claw-cover.bin'],

      ['colorTimerMesh', 'extra/project-wg-model/ber.bin']
   ]

   const model: Record<string, number[]> = {}
   for (const [name, path] of modelPath) {
      model[name] = await $().get(path, {}, async resp => {
         const arrayBuffer = await resp.arrayBuffer()
         const floatArray = new Float32Array(arrayBuffer)
         return Array.from(floatArray)
      })
   }

   const imagePath = [
      ['staticFace', 'extra/images/static-face.png'],
      ['wink', 'extra/images/wink.png'],
   ]

   const images: Record<string, ImageBitmap> = {}
   for (const [name, path] of imagePath) {
      images[name] = await $().get(path, {}, async resp => {
         const blob = await resp.blob()
         return createImageBitmap(blob, {
            premultiplyAlpha: 'none',
            colorSpaceConversion: 'none',
         })
      })
   }

   initializeGL(gl, model)
   resizeGL(gl, canvas.width, canvas.height)

   const [screenCx, renderScreen] = initScreenRenderer(gl, glx, images)
   setScreenRenderer(renderScreen)

   const statusRef = {
      status: initStatus({
         entityStatus: {
            translate: [0.0, 35.0, 75.0],
            rotation: [10.0, 0.0, 0.0]
         },
         armStatus: {
            left: {
               rotation: [0, -75, 0, 15, 0]
            },
            right: {
               rotation: [0, -75, 0, -15, 0]
            }
         }
      })
   }

   body.addEventListener('mousemove', e => {
      const { clientWidth, clientHeight } = body
      const [width, twoThirdHeight, halfHeight] = [clientWidth - 150, clientHeight * 2 / 3, clientHeight / 2]
      const { x, y } = e

      statusRef.status.headStatus.rotationX = ((y - twoThirdHeight) / halfHeight) * 30.0
      statusRef.status.headStatus.rotationY = ((x - width) / width) * 15
      statusRef.status.headStatus.rotationZ = ((x - width) / width) * - 10.0
   })

   body.addEventListener('mousedown', () => {
      if (screenCx.modeTimeout) {
         clearTimeout(screenCx.modeTimeout)
      }
      screenCx.mode = 'wink'
   })
   body.addEventListener('mouseup', () => {
      if (screenCx.modeTimeout) {
         clearTimeout(screenCx.modeTimeout)
      }

      screenCx.modeTimeout = setTimeout(() => {
         delete screenCx.mode
         delete screenCx.modeTimeout
      }, 200)
   })

   const main = () => {
      const gl = canvas.getContext('webgl')
      paintGL(gl, statusRef)

      requestAnimationFrame(main)
   }

   const animMainLoop = requestAnimationFrame(main)

   console.info(`[I] 电子宠物加载完毕`)

   const contextMenu = (
      <div class="context-menu" style="display: none">
         <div class="context-menu-item" onClick={() => {
            cancelAnimationFrame(animMainLoop)
            canvas.remove()

            contextMenu.style.display = 'none'
         }}>
            暂时关闭
         </div>
         <div class="context-menu-item" onClick={() => {
            console.error(`[E] 窝这么可爱你竟然要把窝关掉，下个版本拿你电脑挖矿`)
            window.localStorage.setItem('hideWG', '扣1送地狱火 111111大哥真送吗')

            cancelAnimationFrame(animMainLoop)
            canvas.remove()

            contextMenu.style.display = 'none'
         }}>
            不再显示
         </div>
         <hr />
         <div class="context-menu-item" onClick={() => {
            contextMenu.style.display = 'none'
         }}>
            关闭菜单
         </div>
      </div>
   )

   canvas.addEventListener('contextmenu', e => {
      e.preventDefault()

      contextMenu.style.left = `${e.clientX}px`
      contextMenu.style.top = `${e.clientY}px`
      contextMenu.style.display = 'block'
   })

   body.appendChild(contextMenu)
}

export default () => {
   // get localStorage
   const hideWG = window.localStorage.getItem('hideWG')

   if (!('ontouchstart' in document.documentElement) && !hideWG) {
      // 只在桌面平台上加载看板娘，因为移动平台上收不到鼠标事件
      // 如果用户选择手动关闭，那么也不显示
      loadWGLite().then(() => {})
   }
}
