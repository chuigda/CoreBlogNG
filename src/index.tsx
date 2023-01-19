import { h } from 'tsx-dom'

import NavBar from './components/nav-bar'
import BlogRead from './views/blog-read'
import About from './views/about-page'
import BlogList from './views/blog-list'

import wgc0310 from './wgc0310'

import './index.css'

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

wgc0310()