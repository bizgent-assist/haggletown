import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import Landing from './pages/Landing.jsx';
import Town from './pages/Town.jsx';
import Merchant from './pages/Merchant.jsx';
import Ledger from './pages/Ledger.jsx';
import Account from './pages/Account.jsx';
import NotFound from './pages/NotFound.jsx';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Landing />} />
        <Route path="town" element={<Town />} />
        <Route path="merchant/:slug" element={<Merchant />} />
        <Route path="ledger" element={<Ledger />} />
        <Route path="account" element={<Account />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
