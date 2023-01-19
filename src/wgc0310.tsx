import { h } from 'tsx-dom'

const importDynamic = (path: string) => import(/* @vite-ignore */ path)

const loadImage = (path: string) => {
   return new Promise((resolve, reject) => {
      const img = new Image()
      img.src = path
      img.onload = () => resolve(img)
      img.onerror = reject
   })
}

const loadWGLite = async () => {
   const { initializeGL, resizeGL, paintGL, initStatus } = await importDynamic('./extra/project-wg-lite.mjs')
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
      images[name] = (await loadImage(path)) as ImageBitmap
   }

   initializeGL(gl, model)
   resizeGL(gl, canvas.width, canvas.height)

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
      const [halfWidth, twoThirdHeight, halfHeight] = [clientWidth / 2, clientHeight * 2 / 3, clientHeight / 2]
      const { x, y } = e

      statusRef.status.headStatus.rotationX = ((y - twoThirdHeight) / halfHeight) * 30.0
      statusRef.status.headStatus.rotationY = ((x - halfWidth) / halfWidth) * 15
      statusRef.status.headStatus.rotationZ = ((x - halfWidth) / halfWidth) * - 10.0
   })

   /*
   body.addEventListener('mousedown', () => {
      console.log('mouse down')
   })

   body.addEventListener('mouseup', () => {
      console.log('mouse up')
   })
   */

   const main = () => {
      const gl = canvas.getContext('webgl')
      paintGL(gl, statusRef)

      requestAnimationFrame(main)
   }

   requestAnimationFrame(main)

   console.info(`[I] 电子宠物加载完毕`)
}

export default () => {
   if (!('ontouchstart' in document.documentElement)) {
      // 只在桌面平台上加载看板娘，因为移动平台上收不到鼠标事件
      loadWGLite().then(() => {})
   }
}
