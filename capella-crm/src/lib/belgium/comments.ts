export type ClientComment={id:string;mega_id:string;centre:string;author_id:string;author_name:string;body:string;created_at:string;updated_at:string};
export type CommentRevision={id:string;comment_id:string;mega_id:string;centre:string;editor_id:string;editor_name:string;before_body:string|null;after_body:string;created_at:string};
