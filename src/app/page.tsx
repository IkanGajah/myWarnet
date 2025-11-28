'use client';

import Image from "next/image";
import Link from "next/link";

export default function Home() {
  return (
    <main>
      <div className="rounded-lg overflow-hidden shadow-lg max-w-8xl mx-auto">
        <div className="pt-18 flex flex-col justify-center items-center text-center text-black bg-gray-100 px-4">
          <Image src="/assetImage/hengker.jpg" alt="Profile" className="w-40 h-40 rounded-full shadow-lg border-4 border-black mb-6 object-cover" width={200} height={200} />
          <h1 className="text-5xl font-bold mb-2">Warnetku</h1>
          <p className="text-lg">Warnet kecil</p>        
        </div>
        <div id="about" className="py-10 px-6 bg-gray-100 text-gray-800">   
          <div className="max-w-5xl mx-auto text-center bg-white rounded-2xl p-6">
            <h2 className="text-4xl font-bold mb-6">Selamat Datang!</h2>
            <p className="mb-2 text-lg text-gray-600 ">Selamat datang, ini adalah web warnet yang kami gunakan untuk memonitor komputer-komputer di warnet kami. 
              Untuk mulai menggunakan komputer, silahkan kunjungi halaman Komputer dan pilih PC yang tersedia atau bisa klik tombol dibawah. 
              Setelah selesai, pastikan untuk mengakhiri sesi agar komputer siap digunakan oleh pelanggan berikutnya.</p>
          </div>
          <Link href='/komputer' className="px-1 py-2 mr-auto ml-auto max-w-5xl
           text-2xl mt-10 bg-green-600 text-white outline-2 hover:bg-white hover:text-black font-bold rounded flex justify-center outline">Mulai dari sini!</Link>
        </div>
      </div>
    </main>
  );
}
