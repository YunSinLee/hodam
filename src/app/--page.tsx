"use client";

// import Image from 'next/image'
// import styles from './page.module.css'
import Head from "next/head";
import Link from "next/link";

interface IMovie {
  adult: boolean;
  backdrop_path: string;
  genre_ids: number[];
  id: number;
  original_language: string;
  original_title: string;
  overview: string;
  popularity: number;
  poster_path: string;
  release_date: string;
  title: string;
  video: boolean;
  vote_average: number;
  vote_count: number;
}

async function fetchData() {
  const { results } = await (
    await fetch("http://localhost:3000/api/movies", {
      cache: "no-store",
    })
  ).json();
  return results;
}

export default async function Home() {
  // const [movies, setMovies] = useState();
  // useEffect(() => {
  //   (async () => {
  //     const { results } = await (await fetch("/api/movies")).json();
  //     setMovies(results);
  //   })();
  // }, []);
  const results = await fetchData();
  return (
    <div className="container">
      <Head>
        <title>Home | Next Movies</title>
      </Head>
      {!results && <h4>Loading...</h4>}
      {results?.map((movie: IMovie) => (
        <Link
          as={`/movies/${movie.id}`}
          href={{
            pathname: `/movies/${movie.id}`,
            query: { title: movie.title },
          }}
          key={movie.id}
        >
          <div className="movie">
            <img src={`https://image.tmdb.org/t/p/w500/${movie.poster_path}`} />
            <h4>{movie.original_title}</h4>
          </div>
        </Link>
      ))}
      <style jsx>{`
        .container {
          display: grid;
          grid-template-columns: 1fr 1fr;
          padding: 20px;
          gap: 20px;
        }
        .movie img {
          max-width: 100%;
          border-radius: 12px;
          transition: transform 0.2s ease-in-out;
          box-shadow: rgba(0, 0, 0, 0.1) 0px 4px 12px;
        }
        .movie:hover img {
          transform: scale(1.05) translateY(-10px);
        }
        .movie h4 {
          font-size: 18px;
          text-align: center;
        }
      `}</style>
    </div>
  );
}
