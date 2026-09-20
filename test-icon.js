import { Megaphone } from 'lucide-react';
import { renderToString } from 'react-dom/server';
import React from 'react';

console.log(renderToString(React.createElement(Megaphone)));
