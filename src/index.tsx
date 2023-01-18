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
   console.log(path)
   if (path.length === 0) {
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
