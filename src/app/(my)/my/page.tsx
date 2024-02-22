import Link from "next/link";

export const API_URL = "nomad-movies.nomadcoders.workers.dev/movies";

const fetchMovies = async () => {
  await new Promise(resolve => setTimeout(resolve, 1000));
  const response = await fetch(`https://${API_URL}`);
  const json = await response.json();
  return json;
};

export default async function Result() {
  const movies = await fetchMovies();

  return (
    <div>
      {movies.map((movie: any) => (
        <li key={movie.id}>
          <Link href={`my/${movie.id}`}>{movie.title}</Link>
        </li>
      ))}
    </div>
  );
}
