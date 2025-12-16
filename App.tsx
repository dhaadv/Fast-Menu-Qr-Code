import React from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import Creator from './components/Creator';
import MenuEditor from './components/MenuEditor';
import Success from './components/Success';
import MenuViewer from './components/MenuViewer';

const App: React.FC = () => {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Creator />} />
        <Route path="/editor/:id" element={<MenuEditor />} />
        <Route path="/success/:id" element={<Success />} />
        {/* Support both ID and Slug for backward compatibility and pretty URLs */}
        <Route path="/menu/:id" element={<MenuViewer />} />
        <Route path="/m/:slug" element={<MenuViewer />} />
      </Routes>
    </HashRouter>
  );
};

export default App;