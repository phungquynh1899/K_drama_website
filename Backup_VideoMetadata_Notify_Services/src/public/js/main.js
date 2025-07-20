// Main JavaScript file for the video website

document.addEventListener('DOMContentLoaded', function() {
    // Search functionality
    const searchForm = document.getElementById('searchForm');
    const searchInput = document.getElementById('searchInput');
    
    if (searchForm) {
        searchForm.addEventListener('submit', function(e) {
            e.preventDefault();
            const query = searchInput.value.trim();
            if (query) {
                window.location.href = `/search?q=${encodeURIComponent(query)}`;
            }
        });
    }
    
    // Filter functionality
    const filterSelects = document.querySelectorAll('.filter-select');
    filterSelects.forEach(select => {
        select.addEventListener('change', function() {
            applyFilters();
        });
    });
    
    function applyFilters() {
        const category = document.getElementById('categoryFilter')?.value || '';
        const genre = document.getElementById('genreFilter')?.value || '';
        const country = document.getElementById('countryFilter')?.value || '';
        const year = document.getElementById('yearFilter')?.value || '';
        const duration = document.getElementById('durationFilter')?.value || '';
        const sortBy = document.getElementById('sortFilter')?.value || '';
        
        const params = new URLSearchParams();
        if (category) params.append('category', category);
        if (genre) params.append('genre', genre);
        if (country) params.append('country', country);
        if (year) params.append('year', year);
        if (duration) params.append('duration', duration);
        if (sortBy) params.append('sort', sortBy);
        
        const currentUrl = new URL(window.location);
        const searchParams = currentUrl.searchParams.get('q');
        if (searchParams) params.append('q', searchParams);
        
        window.location.href = `${currentUrl.pathname}?${params.toString()}`;
    }
    
    // Movie card hover effects
    const movieCards = document.querySelectorAll('.movie-card');
    movieCards.forEach(card => {
        card.addEventListener('mouseenter', function() {
            this.style.transform = 'translateY(-5px)';
        });
        
        card.addEventListener('mouseleave', function() {
            this.style.transform = 'translateY(0)';
        });
    });
    
    // Ranking tabs functionality
    const rankingTabs = document.querySelectorAll('.ranking-tab');
    rankingTabs.forEach(tab => {
        tab.addEventListener('click', function() {
            // Remove active class from all tabs
            rankingTabs.forEach(t => t.classList.remove('active'));
            // Add active class to clicked tab
            this.classList.add('active');
            
            const period = this.dataset.period;
            loadRankingData(period);
        });
    });
    
    function loadRankingData(period) {
        // This would typically make an AJAX call to load ranking data
        console.log('Loading ranking data for period:', period);
        // For now, just show a loading message
        const rankingContainer = document.querySelector('.ranking-content');
        if (rankingContainer) {
            rankingContainer.innerHTML = '<div class="loading">Loading ranking data...</div>';
        }
    }
    
    // Episode selection
    const episodeButtons = document.querySelectorAll('.episode-btn');
    episodeButtons.forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.preventDefault();
            const episodeId = this.dataset.episode;
            const movieId = this.dataset.movie;
            
            // Navigate to player page
            window.location.href = `/player/${movieId}/${episodeId}`;
        });
    });
    
    // Player controls
    const prevBtn = document.getElementById('prevEpisode');
    const nextBtn = document.getElementById('nextEpisode');
    
    if (prevBtn) {
        prevBtn.addEventListener('click', function() {
            const currentEpisode = parseInt(this.dataset.current);
            const movieId = this.dataset.movie;
            if (currentEpisode > 1) {
                window.location.href = `/player/${movieId}/${currentEpisode - 1}`;
            }
        });
    }
    
    if (nextBtn) {
        nextBtn.addEventListener('click', function() {
            const currentEpisode = parseInt(this.dataset.current);
            const movieId = this.dataset.movie;
            const totalEpisodes = parseInt(this.dataset.total);
            if (currentEpisode < totalEpisodes) {
                window.location.href = `/player/${movieId}/${currentEpisode + 1}`;
            }
        });
    }
    
    // Lazy loading for movie posters
    const moviePosters = document.querySelectorAll('.movie-poster');
    const imageObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const img = entry.target;
                img.src = img.dataset.src;
                img.classList.remove('lazy');
                observer.unobserve(img);
            }
        });
    });
    
    moviePosters.forEach(poster => {
        if (poster.dataset.src) {
            imageObserver.observe(poster);
        }
    });
    
    // Auto-complete search suggestions
    let searchTimeout;
    if (searchInput) {
        searchInput.addEventListener('input', function() {
            clearTimeout(searchTimeout);
            const query = this.value.trim();
            
            if (query.length >= 2) {
                searchTimeout = setTimeout(() => {
                    fetchSearchSuggestions(query);
                }, 300);
            }
        });
    }
    
    function fetchSearchSuggestions(query) {
        // This would make an AJAX call to get search suggestions
        console.log('Fetching suggestions for:', query);
        // Implementation would depend on your backend API
    }
    
    // Keyboard shortcuts
    document.addEventListener('keydown', function(e) {
        // Space bar to play/pause video (if on player page)
        if (e.code === 'Space' && window.location.pathname.includes('/player')) {
            e.preventDefault();
            // Toggle video play/pause
            const video = document.querySelector('video');
            if (video) {
                if (video.paused) {
                    video.play();
                } else {
                    video.pause();
                }
            }
        }
        
        // Escape to exit fullscreen
        if (e.code === 'Escape') {
            if (document.fullscreenElement) {
                document.exitFullscreen();
            }
        }
    });
    
    // Mobile menu toggle
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    const navMenu = document.querySelector('.nav-menu');
    
    if (mobileMenuBtn && navMenu) {
        mobileMenuBtn.addEventListener('click', function() {
            navMenu.classList.toggle('active');
        });
    }
    
    // Smooth scrolling for anchor links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });
    
    // Initialize tooltips for movie cards
    const tooltipElements = document.querySelectorAll('[data-tooltip]');
    tooltipElements.forEach(element => {
        element.addEventListener('mouseenter', function() {
            const tooltip = document.createElement('div');
            tooltip.className = 'tooltip';
            tooltip.textContent = this.dataset.tooltip;
            document.body.appendChild(tooltip);
            
            const rect = this.getBoundingClientRect();
            tooltip.style.left = rect.left + (rect.width / 2) - (tooltip.offsetWidth / 2) + 'px';
            tooltip.style.top = rect.top - tooltip.offsetHeight - 10 + 'px';
        });
        
        element.addEventListener('mouseleave', function() {
            const tooltip = document.querySelector('.tooltip');
            if (tooltip) {
                tooltip.remove();
            }
        });
    });
});

// Utility functions
function formatDuration(minutes) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('vi-VN', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

function truncateText(text, maxLength) {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
} 