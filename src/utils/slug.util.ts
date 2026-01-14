import slugify from 'slugify';

export function generateSlug(text: string, appendRandomSuffix?: boolean): string {
    let slug = slugify(text, {
        lower: true,
        strict: true, // Removes non-alphanumeric characters
        remove: /[*+~.()'"!:@]/g, // Further removes additional special characters
        trim: true
    });

    if (appendRandomSuffix) {
        const characters = '123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
        let hash = '';
        for (let i = 0; i < 4; i++) {
            const randomIndex = Math.floor(Math.random() * characters.length);
            hash += characters[randomIndex];
        }
        slug += `-${hash}`;
    }
    return slug;
}
