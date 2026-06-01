from datetime import datetime

from app.models.blog import Post
from app.schemas.blog import AuthorOut, CategoryOut, PostDetail, PostListItem
from app.services.storage import resolve_image_url


def post_to_list_item(post: Post) -> PostListItem:
    return PostListItem(
        id=post.id,
        slug=post.slug,
        date=(post.published_at or post.created_at).isoformat(),
        title=post.title,
        excerpt=post.excerpt,
        featuredImage=resolve_image_url(post.featured_image_key),
        categoryNames=[CategoryOut.model_validate(c) for c in post.categories],
        authorId=post.author_id,
    )


def post_to_detail(post: Post) -> PostDetail:
    author = None
    if post.author:
        author = AuthorOut.model_validate(post.author)
    return PostDetail(
        id=post.id,
        slug=post.slug,
        date=(post.published_at or post.created_at).isoformat(),
        title=post.title,
        excerpt=post.excerpt,
        content=post.content_html,
        featuredImage=resolve_image_url(post.featured_image_key),
        categoryNames=[CategoryOut.model_validate(c) for c in post.categories],
        authorId=post.author_id,
        author=author,
        metaTitle=post.meta_title or post.title,
        metaDescription=post.meta_description or post.excerpt,
        seoNoindex=post.seo_noindex,
    )
