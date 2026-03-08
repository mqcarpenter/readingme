// pages/api/recommend.js
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { title, author } = req.query;

  if (!title) {
    return res.status(400).json({ error: 'Missing title parameter for recommendations.' });
  }

  try {
    // We search Google Books for the same title/author to find related subjects
    const searchUrl = `https://www.googleapis.com/books/v1/volumes?q=intitle:${encodeURIComponent(title)}+inauthor:${encodeURIComponent(author || '')}&langRestrict=en`;
    const searchRes = await fetch(searchUrl);
    const searchData = await searchRes.json();
    
    let subjects = [];
    if (searchData.items && searchData.items.length > 0) {
      subjects = searchData.items[0].volumeInfo.categories || [];
    }
    
    // If we have subjects, search for books in those subjects, else fallback to searching by author
    let query = '';
    if (subjects.length > 0) {
       // Just take the first subject for broad results
       query = `subject:${encodeURIComponent(subjects[0])}`;
    } else if (author) {
       query = `inauthor:${encodeURIComponent(author)}`;
    } else {
       query = `intitle:${encodeURIComponent(title)}`; // weak fallback
    }

    const recUrl = `https://www.googleapis.com/books/v1/volumes?q=${query}&maxResults=15&langRestrict=en`;
    const recRes = await fetch(recUrl);
    const recData = await recRes.json();

    if (!recData.items) {
      return res.status(200).json({ recommendations: [] });
    }

    // Apply the Rubric and Scoring algorithm
    const scoredBooks = [];
    
    for (const item of recData.items) {
      const info = item.volumeInfo;
      
      // Don't recommend the exact same book they clicked on
      if (info.title && info.title.toLowerCase() === title.toLowerCase()) continue;

      let score = 0;
      let reasons = [];

      // Rubric 1: Author Match (+3)
      if (author && info.authors && info.authors.some(a => a.toLowerCase().includes(author.toLowerCase()))) {
        score += 3;
        reasons.push(`written by ${author}`);
      }

      // Rubric 2: Subject/Category Match (+2)
      if (subjects.length > 0 && info.categories) {
        let matchCount = 0;
        info.categories.forEach(cat => {
            if (subjects.some(sub => sub.toLowerCase().includes(cat.toLowerCase()) || cat.toLowerCase().includes(sub.toLowerCase()))) {
                matchCount++;
            }
        });
        if (matchCount > 0) {
            score += 2;
            reasons.push(`shares the '${subjects[0]}' genre`);
        }
      }

      // Rubric 3: High Rating (+2)
      const avgRating = info.averageRating || 0;
      if (avgRating >= 4.0) {
        score += 2;
        reasons.push(`is highly rated (${avgRating}/5 stars)`);
      }

      // Rubric 4: Popularity / Relevance (+1)
      const ratingsCount = info.ratingsCount || 0;
      if (ratingsCount > 100) {
        score += 1;
        reasons.push(`is widely popular`);
      }

      // Ensure a minimum floor score just for showing up in the Google API results
      if (score === 0) {
        score = 1;
        reasons.push("is generally related to your search");
      }

      // Construct brief explanation
      const explanation = `Score: ${score}/8. Recommended because it ${reasons.join(', and ')}.`;
      
      // Determine Image
      const imageUrl = info.imageLinks ? info.imageLinks.thumbnail.replace('http:', 'https:') : 'https://s.gr-assets.com/assets/nophoto/book/111x148-bcc042a9c91a29c1d680899eff700a03.png';

      // Determine ISBN
      let isbn13 = null;
      if (info.industryIdentifiers) {
         const found = info.industryIdentifiers.find(id => id.type === 'ISBN_13');
         if (found) isbn13 = found.identifier;
      }

      scoredBooks.push({
        title: info.title || 'Unknown Title',
        author: info.authors ? info.authors.join(', ') : 'Unknown Author',
        imageUrl,
        isbn13,
        score,
        explanation
      });
    }

    // Sort descending by score, take top 5
    scoredBooks.sort((a, b) => b.score - a.score);
    const top5 = scoredBooks.slice(0, 5);

    res.status(200).json({ recommendations: top5 });

  } catch (error) {
    console.error('Recommendation Error:', error);
    res.status(500).json({ error: 'Failed to fetch recommendations.' });
  }
}
