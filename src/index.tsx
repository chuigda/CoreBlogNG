import { h } from 'tsx-dom'

import NavBar from './components/nav-bar'
import About from './views/about-page'

import './index.css'

const handleRoute = () => {
   const app = $('#app')
   const path = window.location.hash
      .slice(1)
      .split('/')
      .filter(part => part !== '')

   app.innerHTML = ''
   console.log(path)
   if (path.length === 0) {
      app.appendChild(<div>随想</div>)
   } else if (path[0] === 'tech') {
      app.appendChild(<div>技术</div>)
   } else if (path[0] === 'about') {
      app.appendChild(<About />)
   } else if (path[0] === 'link') {
      app.appendChild(<div>友链</div>)
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
