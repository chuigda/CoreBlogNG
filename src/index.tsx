import { h } from 'tsx-dom'

import NavBar from './components/nav-bar'
import BlogRead from './views/blog-read'
import About from './views/about-page'

import './index.css'
import BlogList from "./views/blog-list";

const handleRoute = () => {
   const app = $('#app')
   const path = window.location.hash
      .slice(1)
      .split('/')
      .filter(part => part !== '')

   app.innerHTML = ''
   if (path.length === 0 || path[0] === 'liberal') {
      app.appendChild(<BlogList liberal={true} />)
   } else if (path[0] === 'tech') {
      app.appendChild(<BlogList liberal={false} />)
   } else if (path[0] === 'about') {
      app.appendChild(<About />)
   } else if (path[0] === 'link') {
      app.appendChild(<div>友链功能尚未完成，敬请期待</div>)
   } else if (path[0] === 'blog') {
      app.appendChild(<BlogRead blogId={ path[1] }/>)
   }
}

const App = () => {
   window.addEventListener('hashchange', handleRoute)
   setTimeout(handleRoute, 0)

   return (
      <div>
         <NavBar />
         <hr/>
         <div id="app">
         </div>
      </div>
   )
}

$('body').appendChild(<App />)

// Fuck vite everyday on the banana tree
const importDynamic = (path: string) => import(/* @vite-ignore */ path)

const loadWGLite = async () => {
   const { initializeGL, resizeGL, paintGL, initStatus } = await importDynamic('./extra/project-wg-lite.mjs')

   $('body').appendChild(
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
      ['wheelMesh', 'extra/project-wg-extra/project-wg-model/wheel.bin'],
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

   const main = () => {
      const gl = canvas.getContext('webgl')
      paintGL(gl, statusRef)

      requestAnimationFrame(main)
   }

   requestAnimationFrame(main)
}

loadWGLite().then(() => {})
