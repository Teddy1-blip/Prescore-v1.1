'use client';
import {useState}from'react';import{authClient}from'../../lib/auth/client';
export default function Logout(){const[error,setError]=useState('');return <main className="ps-auth-page"><h1>Выход из Prescore</h1><p>Сохранённые анализы останутся в вашем кабинете.</p><button onClick={async()=>{const r=await authClient.signOut();if(r.error)setError('Не удалось завершить сеанс. Повторите попытку.');else window.location.assign('/login');}}>Выйти</button><p role="status">{error}</p></main>;}
